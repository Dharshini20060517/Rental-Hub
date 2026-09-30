'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns } from '@/lib/api-client'
import { trackView } from '@/hooks/use-recently-viewed'
import { useAvailabilityUpdates } from '@/hooks/use-socket'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { RatingStars } from '@/components/shared/rating-stars'
import { LoadingState, CardGridSkeleton } from '@/components/shared/states'
import { EmptyState, ErrorState, StatusBadge } from '@/components/shared/feedback'
import { Pagination } from '@/components/shared/pagination'
import { Lightbox } from '@/components/shared/lightbox'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { PricingCalculator } from '@/components/equipment/pricing-calculator'
import { RatingDistribution } from '@/components/equipment/rating-distribution'
import { AvailabilityCalendar } from '@/components/equipment/availability-calendar'
import { FullAvailabilityCalendar } from '@/components/equipment/full-availability-calendar'
import { PriceInsight } from '@/components/equipment/price-insight'
import { TrustSafety } from '@/components/equipment/trust-safety'
import { FaqSection } from '@/components/equipment/faq-section'
import { FrequentlyTogetherSection } from '@/components/equipment/frequently-together-section'
import type { PricingRule } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Heart, GitCompareArrows, MapPin, ShieldCheck, CalendarClock, Wrench, Package, Star, ChevronLeft, BadgeCheck, Clock, Share2, Mail, ThumbsUp, Info, ListChecks, Wallet,
} from 'lucide-react'
import { formatCurrency, conditionLabel, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function EquipmentDetailView() {
  const id = useRouterStore((s) => s.params.id)
  const navigate = useRouterStore((s) => s.navigate)
  const back = useRouterStore((s) => s.back)
  const user = useAuthStore((s) => s.user)
  const toggleCompare = useRouterStore((s) => s.toggleCompare)
  const compareIds = useRouterStore((s) => s.compareIds)
  const qc = useQueryClient()
  const [activeImg, setActiveImg] = useState(0)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewSort, setReviewSort] = useState<'newest' | 'helpful' | 'highest' | 'lowest'>('newest')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' })
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ message: '' })

  const { data: item, isLoading, isError, refetch } = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => apiFns.getEquipment(id!),
    enabled: !!id,
  })

  const { data: reviews } = useQuery({
    queryKey: ['equipment', id, 'reviews', reviewPage, reviewSort],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get(`/equipment/${id}/reviews`, { params: { page: reviewPage, limit: 5, sort: reviewSort } })
      return { rows: res.data.data || [], total: res.data.meta?.total ?? 0, totalPages: res.data.meta?.totalPages ?? 0 }
    },
    enabled: !!id,
  })

  const { data: availability, refetch: refetchAvailability } = useQuery({
    queryKey: ['equipment', id, 'availability'],
    queryFn: () => apiFns.listAvailability(id!),
    enabled: !!id,
  })

  // Real-time availability updates via Socket.IO (falls back to 30s polling)
  useAvailabilityUpdates(id, useCallback(() => {
    refetchAvailability()
    toast.info('Availability updated in real-time')
  }, [refetchAvailability]))

  // Related equipment (same category, exclude current)
  const { data: related } = useQuery<EquipmentListItem[]>({
    queryKey: ['equipment', 'related', item?.categoryId, id],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/equipment', { params: { category: item!.categoryId, limit: 4, sort: 'rating', order: 'desc' } })
      return (res.data.data || []).filter((e: EquipmentListItem) => e.id !== id).slice(0, 4) as EquipmentListItem[]
    },
    enabled: !!item,
  })

  // Owner profile + other listings
  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', item?.ownerId, id],
    queryFn: () => apiFns.getOwnerProfile(item!.ownerId, item!.id),
    enabled: !!item,
  })

  const inCompare = item ? compareIds.includes(item.id) : false

  // Track recently viewed
  useEffect(() => {
    if (item) {
      trackView({
        id: item.id,
        title: item.title,
        coverUrl: item.images.find((i) => i.isPrimary)?.url || item.images[0]?.url || null,
        baseDailyPrice: item.baseDailyPrice,
        city: item.city,
      })
    }
  }, [item?.id])

  async function toggleWish() {
    if (!user) {
      toast.info('Please log in to save to wishlist')
      navigate('login', { redirect: 'equipment', id: id! })
      return
    }
    try {
      const res = await apiFns.toggleWishlist(id!)
      toast.success(res.inWishlist ? 'Saved to wishlist' : 'Removed from wishlist')
      qc.invalidateQueries({ queryKey: ['wishlist'] })
    } catch {
      toast.error('Could not update wishlist')
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { toast.info('Please log in to review'); navigate('login', { redirect: 'equipment', id: id! }); return }
    if (!item) return
    setReviewBusy(true)
    try {
      await apiFns.createReview({
        receiverId: item.ownerId,
        equipmentId: item.id,
        rating: reviewForm.rating,
        title: reviewForm.title || null,
        body: reviewForm.body || null,
      })
      toast.success('Review submitted!')
      setReviewOpen(false)
      setReviewForm({ rating: 5, title: '', body: '' })
      qc.invalidateQueries({ queryKey: ['equipment', id, 'reviews'] })
      qc.invalidateQueries({ queryKey: ['equipment', id] })
    } catch {
      toast.error('Could not submit review')
    } finally {
      setReviewBusy(false)
    }
  }

  async function voteHelpful(reviewId: string) {
    if (!user) {
      toast.info('Please log in to vote')
      navigate('login', { redirect: 'equipment', id: id! })
      return
    }
    try {
      const res = await apiFns.voteReviewHelpful(reviewId)
      toast.success(res.helpful ? 'Marked as helpful' : 'Removed vote')
      qc.invalidateQueries({ queryKey: ['equipment', id, 'reviews'] })
    } catch {
      toast.error('Could not vote')
    }
  }

  async function shareLink() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: item?.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard!')
      }
    } catch {
      // user cancelled share or clipboard failed
    }
  }

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><CardGridSkeleton count={1} /></div>
  if (isError || !item) return <div className="mx-auto max-w-3xl px-4 py-12"><ErrorState message="Could not load this listing" onRetry={refetch} /></div>

  const images = item.images || []
  const specs = item.specs || []
  const rules: { type: string; value: number; unit: string; minDays?: number; label?: string; start?: string; end?: string }[] =
    (item.pricingRules as never) || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <button onClick={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Home', view: 'home' },
          { label: 'Browse', view: 'search' },
          { label: item.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: gallery */}
        <div>
          <div
            className="group relative overflow-hidden rounded-xl border bg-muted"
            onClick={() => { if (images[activeImg]) { setLightboxIdx(activeImg); setLightboxOpen(true) } }}
          >
            {images[activeImg] ? (
              <>
                { }
                <img src={images[activeImg].url} alt={item.title} className="aspect-[16/10] w-full cursor-zoom-in object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                  Click to enlarge
                </div>
              </>
            ) : (
              <div className="grid aspect-[16/10] w-full place-items-center text-muted-foreground"><Package className="h-12 w-12" /></div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto rh-scroll">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImg(i)}
                  className={cn('h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition', i === activeImg ? 'border-primary opacity-100' : 'border-transparent opacity-70 hover:opacity-100')}
                >
                  { }
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <Tabs defaultValue="overview" className="mt-6">
            <TabsList>
              <TabsTrigger value="overview"><Info className="mr-1.5 h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="specs"><ListChecks className="mr-1.5 h-3.5 w-3.5" />Specs</TabsTrigger>
              <TabsTrigger value="pricing"><Wallet className="mr-1.5 h-3.5 w-3.5" />Pricing</TabsTrigger>
              <TabsTrigger value="availability"><CalendarClock className="mr-1.5 h-3.5 w-3.5" />Availability</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3 text-sm leading-relaxed">
              <p className="whitespace-pre-line text-muted-foreground">{item.description}</p>
              {item.conditionNotes && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-1 flex items-center gap-1.5 font-medium"><Wrench className="h-4 w-4 text-primary" /> Condition notes</p>
                  <p className="text-muted-foreground">{item.conditionNotes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{conditionLabel(item.condition)}</Badge>
                {item.bufferHours > 0 && <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> {item.bufferHours}h buffer</Badge>}
                <StatusBadge status={item.status} />
              </div>
            </TabsContent>

            <TabsContent value="specs">
              {specs.length === 0 ? (
                <EmptyState title="No specifications listed" />
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {specs.map((s, i) => (
                        <tr key={s.id} className={i % 2 ? 'bg-muted/30' : ''}>
                          <td className="px-4 py-2.5 font-medium">{s.key}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pricing" className="space-y-3">
              <div className="rounded-lg border p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Base daily price</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(item.baseDailyPrice)}<span className="text-sm font-normal text-muted-foreground">/day</span></span>
                </div>
                {item.baseHourlyPrice != null && (
                  <div className="mt-2 flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Hourly</span>
                    <span className="font-semibold">{formatCurrency(item.baseHourlyPrice)}/hr</span>
                  </div>
                )}
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Security deposit</span>
                  <span className="font-semibold">{formatCurrency(item.baseDeposit)}</span>
                </div>
                {item.replacementValue != null && (
                  <div className="mt-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">Replacement value</span>
                    <span>{formatCurrency(item.replacementValue)}</span>
                  </div>
                )}
              </div>
              {rules.length > 0 && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Dynamic pricing rules</p>
                  <div className="space-y-2">
                    {rules.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{r.label || r.type.replace(/_/g, ' ')}</p>
                          {r.type === 'long_discount' && r.minDays && <p className="text-xs text-muted-foreground">for {r.minDays}+ day rentals</p>}
                          {r.type === 'seasonal' && <p className="text-xs text-muted-foreground">{formatDate(r.start)} → {formatDate(r.end)}</p>}
                        </div>
                        <span className={cn('font-bold', r.type === 'long_discount' ? 'text-emerald-600' : 'text-primary')}>
                          {r.unit === 'percent' ? `${r.value}%` : formatCurrency(r.value)}
                          {r.type === 'long_discount' ? ' off' : ' surcharge'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Bookings & payments arrive in Phase 2. This page shows availability and pricing for now.</p>

              <PricingCalculator
                baseDailyPrice={item.baseDailyPrice}
                baseDeposit={item.baseDeposit}
                pricingRules={rules as PricingRule[]}
              />

              <PriceInsight equipmentId={item.id} currentPrice={item.baseDailyPrice} />
            </TabsContent>

            <TabsContent value="availability" className="space-y-4">
              <FullAvailabilityCalendar equipmentId={item.id} />
              <div>
                <p className="mb-2 text-sm font-medium">Blocked date ranges</p>
                {(availability as { id: string; startDate: string; endDate: string; reason: string }[] | undefined)?.length ? (
                  <div className="space-y-2">
                    {(availability as { id: string; startDate: string; endDate: string; reason: string }[]).map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-amber-500" />
                          <span className="capitalize">{b.reason.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-muted-foreground">{formatDate(b.startDate)} → {formatDate(b.endDate)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No availability blocks — this equipment is available for booking on any future date.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: purchase card + owner */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold leading-tight">{item.title}</h1>
              <StatusBadge status={item.status} />
            </div>
            <div className="mb-3 flex items-center gap-2">
              <RatingStars rating={item.rating} size={15} count={item.reviewCount} />
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{item.city || 'Location on request'}</span>
            </div>

            <div className="my-4 rounded-lg bg-muted/40 p-3">
              <div className="text-3xl font-bold text-primary">{formatCurrency(item.baseDailyPrice)}<span className="text-sm font-normal text-muted-foreground">/day</span></div>
              <div className="mt-1 text-xs text-muted-foreground">Deposit {formatCurrency(item.baseDeposit)} · {conditionLabel(item.condition)}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full" onClick={() => navigate('checkout', { equipmentId: item.id, startDate: new Date(Date.now() + 86400000).toISOString(), endDate: new Date(Date.now() + 4 * 86400000).toISOString() })}>
                <CalendarClock className="mr-1.5 h-4 w-4" /> Book now
              </Button>
              <Button variant="outline" onClick={() => navigate('checkout', { equipmentId: item.id, startDate: new Date(Date.now() + 7 * 86400000).toISOString(), endDate: new Date(Date.now() + 10 * 86400000).toISOString() })}>Request dates</Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={toggleWish}><Heart className="mr-1 h-3.5 w-3.5" /> Save</Button>
              <Button
                variant={inCompare ? 'default' : 'outline'}
                size="sm"
                onClick={() => { toggleCompare(item.id); toast.success(inCompare ? 'Removed from compare' : 'Added to compare') }}
              >
                <GitCompareArrows className="mr-1 h-3.5 w-3.5" /> {inCompare ? 'In compare' : 'Compare'}
              </Button>
              <Button variant="outline" size="sm" onClick={shareLink}><Share2 className="mr-1 h-3.5 w-3.5" /> Share</Button>
            </div>

            <div className="mt-4 space-y-2 border-t pt-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified owner & secure deposit hold</p>
              <p className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-primary" /> Real-time availability — no double booking</p>
            </div>
          </div>

          {/* Owner card */}
          <div className="rounded-xl border bg-card p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</p>
            <div className="flex w-full items-center gap-3">
              <Avatar className="h-12 w-12 border">
                {item.owner.avatarUrl && <AvatarImage src={item.owner.avatarUrl} alt="" />}
                <AvatarFallback className="bg-primary/15 font-bold text-primary">{(item.owner.businessName || item.owner.name || 'O').charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-medium">{item.owner.businessName || item.owner.name || 'Owner'} {item.owner.isVerified && <BadgeCheck className="h-4 w-4 text-primary" />}</p>
                <p className="text-xs text-muted-foreground">{item.owner.accountType === 'business' ? 'Business' : 'Individual'} owner</p>
              </div>
            </div>

            {/* Owner stats */}
            {ownerProfile && (
              <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">{(ownerProfile as { stats: { listingsCount: number } }).stats.listingsCount}</p>
                  <p className="text-[10px] text-muted-foreground">Listings</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-500">{(ownerProfile as { stats: { avgRating: number } }).stats.avgRating > 0 ? (ownerProfile as { stats: { avgRating: number } }).stats.avgRating.toFixed(1) : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Avg. rating</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{(ownerProfile as { stats: { reviewsCount: number } }).stats.reviewsCount}</p>
                  <p className="text-[10px] text-muted-foreground">Reviews</p>
                </div>
              </div>
            )}

            {/* Contact button */}
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setContactOpen(true)}>
              <Mail className="mr-1.5 h-4 w-4" /> Contact owner
            </Button>
          </div>

          {/* Trust & safety */}
          {ownerProfile && (
            <TrustSafety
              ownerName={item.owner.businessName || item.owner.name || 'Owner'}
              isVerified={item.owner.isVerified}
              ownerStats={{
                listingsCount: (ownerProfile as { stats: { listingsCount: number } }).stats.listingsCount,
                avgRating: (ownerProfile as { stats: { avgRating: number } }).stats.avgRating,
                reviewsCount: (ownerProfile as { stats: { reviewsCount: number } }).stats.reviewsCount,
                memberSince: (ownerProfile as { stats: { memberSince: string } }).stats.memberSince,
              }}
            />
          )}
        </div>
      </div>

      {/* Owner's other listings */}
      {ownerProfile && (ownerProfile as { listings: unknown[] }).listings.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Package className="h-5 w-5 text-primary" /> More from this owner</h2>
          <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-4">
            {(ownerProfile as { listings: EquipmentListItem[] }).listings.map((l) => (
              <EquipmentCard key={l.id} item={l} />
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Star className="h-5 w-5 text-amber-400" /> Reviews ({item.reviewCount})</h2>
          <div className="flex items-center gap-2">
            {reviews && reviews.rows.length > 0 && (
              <Select value={reviewSort} onValueChange={(v) => { setReviewSort(v as typeof reviewSort); setReviewPage(1) }}>
                <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="helpful">Most helpful</SelectItem>
                  <SelectItem value="highest">Highest rated</SelectItem>
                  <SelectItem value="lowest">Lowest rated</SelectItem>
                </SelectContent>
              </Select>
            )}
            {user && user.id !== item.ownerId && (
              <Button variant="outline" size="sm" onClick={() => setReviewOpen(true)}><Star className="mr-1.5 h-4 w-4" /> Write a review</Button>
            )}
          </div>
        </div>
        {item.reviewCount > 0 && (
          <RatingDistribution equipmentId={item.id} avgRating={item.rating} reviewCount={item.reviewCount} />
        )}
        {reviews?.rows.length ? (
          <div className="space-y-3">
            {reviews.rows.map((r: { id: string; rating: number; title: string | null; body: string | null; createdAt: string; helpfulVotes: number; userVoted: boolean; reviewer: { id: string; name: string | null; avatarUrl: string | null } }) => (
              <div key={r.id} className="rounded-lg border bg-card p-4 transition hover:shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      {r.reviewer.avatarUrl && <AvatarImage src={r.reviewer.avatarUrl} alt="" />}
                      <AvatarFallback className="text-[10px]">{(r.reviewer.name || '?').charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{r.reviewer.name || 'Anonymous'}</span>
                  </div>
                  <RatingStars rating={r.rating} size={13} showValue={false} />
                </div>
                {r.title && <p className="text-sm font-medium">{r.title}</p>}
                {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                  {r.reviewer.id !== user?.id && (
                    <button
                      onClick={() => voteHelpful(r.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        r.userVoted
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      <ThumbsUp className={`h-3.5 w-3.5 ${r.userVoted ? 'fill-primary' : ''}`} />
                      Helpful{r.helpfulVotes > 0 && ` (${r.helpfulVotes})`}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <Pagination page={reviewPage} totalPages={reviews.totalPages} onChange={setReviewPage} />
          </div>
        ) : (
          <EmptyState
            title="No reviews yet"
            description={user ? "Be the first to share your experience." : "Log in to leave a review."}
            icon={Star}
            action={user && user.id !== item.ownerId ? <Button size="sm" onClick={() => setReviewOpen(true)}><Star className="mr-1.5 h-4 w-4" /> Write a review</Button> : undefined}
          />
        )}
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* Frequently rented together (AI co-booking recommendations) */}
      <FrequentlyTogetherSection equipmentId={item.id} />

      {/* Related equipment */}
      {related && related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold">Similar equipment you might like</h2>
          <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-4">
            {related.map((rel) => (
              <EquipmentCard key={rel.id} item={rel} />
            ))}
          </div>
        </section>
      )}

      {/* Write review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a review</DialogTitle>
            <DialogDescription>Share your experience with this equipment and owner.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReview} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                    className="transition hover:scale-110"
                  >
                    <Star className={cn('h-7 w-7', n <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/40')} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rtitle">Title (optional)</Label>
              <Input id="rtitle" value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="Great experience!" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rbody">Your review</Label>
              <Textarea id="rbody" rows={4} value={reviewForm.body} onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })} placeholder="Tell others about the equipment condition, owner responsiveness, etc." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={reviewBusy}>{reviewBusy ? 'Submitting…' : 'Submit review'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      <Lightbox
        images={images.map((img) => ({ id: img.id, url: img.url, caption: item.title }))}
        index={lightboxIdx}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Contact owner dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact {item.owner.businessName || item.owner.name || 'owner'}</DialogTitle>
            <DialogDescription>Send a message about "{item.title}". The owner will be notified (Phase 2: messaging system).</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); toast.success('Message sent! The owner will get back to you.'); setContactOpen(false); setContactForm({ message: '' }) }} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cmsg">Your message</Label>
              <Textarea
                id="cmsg"
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ message: e.target.value })}
                placeholder={`Hi, I'm interested in renting your ${item.title}. Is it available from...?`}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button>
              <Button type="submit"><Mail className="mr-1.5 h-4 w-4" /> Send message</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
