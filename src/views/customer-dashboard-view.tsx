'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { RatingStars } from '@/components/shared/rating-stars'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Heart, Star, Clock, TrendingUp, ArrowRight, Package, Sparkles, MapPin } from 'lucide-react'
import { formatCurrency, timeAgo } from '@/lib/format'

export function CustomerDashboardView() {
  const navigate = useRouterStore((s) => s.navigate)
  const { data, isLoading } = useQuery({ queryKey: ['customer-stats'], queryFn: () => apiFns.customerStats() })

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><CardGridSkeleton count={3} /></div>

  const stats = data as {
    totals: { wishlistCount: number; reviewsCount: number; avgRatingGiven: number }
    wishlist: {
      id: string; equipmentId: string; createdAt: string
      equipment: {
        id: string; title: string; baseDailyPrice: number; city: string | null; status: string
        images: { url: string }[]; category: { name: string }
      }
    }[]
    recentReviews: {
      id: string; rating: number; title: string | null; body: string | null; createdAt: string
      equipment: { id: string; title: string; images: { url: string }[] }
    }[]
    recommended: EquipmentListItem[]
  }

  const kpis = [
    { label: 'Saved items', value: String(stats.totals.wishlistCount), sub: 'in your wishlist', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Reviews written', value: String(stats.totals.reviewsCount), sub: 'shared experiences', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Avg. rating given', value: stats.totals.avgRatingGiven > 0 ? stats.totals.avgRatingGiven.toFixed(1) : '—', sub: 'your reviews', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
    { label: 'Recently viewed', value: '—', sub: 'browsing history', icon: Clock, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your dashboard</h1>
        <p className="text-sm text-muted-foreground">Track your wishlist, reviews, and discover new equipment</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="group overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
            <CardContent className="p-4">
              <div className={`mb-2 grid h-9 w-9 place-items-center rounded-lg ${k.bg} transition-transform duration-300 group-hover:scale-110`}>
                <k.icon className={`h-4.5 w-4.5 ${k.color}`} />
              </div>
              <p className="text-xl font-bold tracking-tight">{k.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Wishlist preview */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-rose-500" /> Your wishlist</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('wishlist')}>View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent>
            {stats.wishlist.length === 0 ? (
              <EmptyState
                title="Your wishlist is empty"
                description="Save equipment you're interested in to track them here."
                icon={Heart}
                action={<Button size="sm" onClick={() => navigate('search')}>Browse equipment</Button>}
              />
            ) : (
              <div className="space-y-2">
                {stats.wishlist.slice(0, 5).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => navigate('equipment', { id: w.equipment.id })}
                    className="group flex w-full items-center gap-3 rounded-lg border bg-card p-2.5 text-left transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {w.equipment.images[0] ? (
                         
                        <img src={w.equipment.images[0].url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="grid h-full w-full place-items-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.equipment.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{w.equipment.category.name}</span>
                        {w.equipment.city && <><span>·</span><span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{w.equipment.city}</span></>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-primary">{formatCurrency(w.equipment.baseDailyPrice)}</p>
                      <p className="text-[10px] text-muted-foreground">/day</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent reviews */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4 text-amber-400" /> Your recent reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentReviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Share your experience to help other renters."
                icon={Star}
              />
            ) : (
              <div className="space-y-2">
                {stats.recentReviews.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate('equipment', { id: r.equipment.id })}
                    className="group flex w-full items-start gap-2 rounded-lg border bg-card p-2.5 text-left transition hover:border-primary/40"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {r.equipment.images[0] ? (
                         
                        <img src={r.equipment.images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{r.equipment.title}</p>
                      <RatingStars rating={r.rating} size={10} showValue={false} />
                      {r.title && <p className="truncate text-xs text-muted-foreground">{r.title}</p>}
                      <p className="text-[10px] text-muted-foreground/70">{timeAgo(r.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommended for you */}
      {stats.recommended.length > 0 && (
        <Card className="mt-4 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Recommended for you</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('search')}>Browse all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-4">
              {stats.recommended.map((item) => (
                <EquipmentCard key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
