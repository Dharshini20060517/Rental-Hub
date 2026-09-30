'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { CardGridSkeleton } from '@/components/shared/states'
import { useRecentlyViewed } from '@/hooks/use-recently-viewed'
import { useCountUp } from '@/hooks/use-count-up'
import { RecommendationWidget } from '@/components/equipment/recommendation-widget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/format'
import {
  Search, MapPin, ShieldCheck, Zap, ArrowRight, Package, Users, Star, LifeBuoy, Wallet, CalendarClock, Clock, Flame, TrendingUp, Quote,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, string> = {
  'power-tools': '⚡',
  'hand-tools': '🔧',
  construction: '🏗️',
  earthmoving: '🚜',
  vehicles: '🚚',
  'audio-video': '🔊',
  'party-events': '🎪',
  'camping-outdoor': '🏕️',
  photography: '📷',
  cleaning: '🧽',
}

export function HomeView() {
  const navigate = useRouterStore((s) => s.navigate)
  const [q, setQ] = useState('')
  const recentlyViewed = useRecentlyViewed()

  const { data: featured, isLoading } = useQuery<EquipmentListItem[]>({
    queryKey: ['equipment', 'featured'],
    queryFn: () => apiFns.listEquipment({ limit: 8, sort: 'createdAt', order: 'desc' }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFns.listCategories(),
  })

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate('search', q ? { q } : {})
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        {/* Multi-layer gradient mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-emerald-500/5 to-transparent" />
        <div className="absolute inset-0 rh-grid-pattern opacity-40" />
        {/* Floating decorative blobs */}
        <div className="rh-float pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="rh-float pointer-events-none absolute -right-20 top-40 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" style={{ animationDelay: '2s' }} />
        <div className="rh-float pointer-events-none absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" style={{ animationDelay: '4s' }} />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Real-time availability engine · Phase 1 live
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              Rent any equipment,
              <span className="rh-text-gradient block">when you need it</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              From power tools to excavators — discover, compare, and book equipment from verified owners.
              Transparent dynamic pricing, live availability, and a full rental lifecycle.
            </p>
            <form onSubmit={onSearch} className="mx-auto mt-7 flex max-w-xl items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try ‘excavator’, ‘camera’, ‘tent’…" className="h-12 pl-10 text-base shadow-sm" />
              </div>
              <Button type="submit" size="lg" className="h-12 px-6">
                Search <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </form>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Verified owners</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> Instant availability</span>
              <span className="inline-flex items-center gap-1.5"><Wallet className="h-4 w-4 text-primary" /> Secure deposits</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-muted/20">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4 sm:px-6">
          {[
            { icon: Package, label: 'Listings', value: 34, suffix: '+' },
            { icon: Users, label: 'Owners & customers', value: 11, suffix: '+' },
            { icon: Star, label: 'Avg. rating', value: 4, suffix: '', decimals: 1 },
            { icon: MapPin, label: 'Cities covered', value: 8, suffix: '' },
          ].map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} suffix={s.suffix} decimals={s.decimals} />
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Browse by category</h2>
              <p className="text-sm text-muted-foreground">Find the right tool for your project</p>
            </div>
            <Button variant="ghost" onClick={() => navigate('search')}>View all <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 rh-stagger">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate('search', { category: c.slug })}
                className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative text-3xl transition-transform duration-300 group-hover:scale-110">{CATEGORY_ICONS[c.slug] || '🧰'}</span>
                <span className="relative font-medium leading-tight">{c.name}</span>
                <span className="relative rh-line-clamp-2 text-xs text-muted-foreground">{c.description || 'Browse listings'}</span>
                <span className="relative mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                  Explore <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Featured equipment</h2>
            <p className="text-sm text-muted-foreground">Freshly listed across the platform</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('search')}>See all <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
        {isLoading ? (
          <CardGridSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(featured || []).map((item) => (
              <EquipmentCard key={item.id} item={item as EquipmentListItem} />
            ))}
          </div>
        )}
      </section>

      {/* Trending */}
      <TrendingSection />

      {/* AI Recommendations */}
      <RecommendationWidget />

      {/* Recently viewed */}
      {recentlyViewed.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Clock className="h-6 w-6 text-primary" /> Recently viewed</h2>
              <p className="text-sm text-muted-foreground">Pick up where you left off</p>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 rh-scroll">
            {recentlyViewed.map((rv) => (
              <button
                key={rv.id}
                onClick={() => navigate('equipment', { id: rv.id })}
                className="group w-56 shrink-0 overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {rv.coverUrl ? (
                     
                    <img src={rv.coverUrl} alt={rv.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground"><Package className="h-8 w-8" /></div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{rv.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{formatCurrency(rv.baseDailyPrice)}<span className="text-xs font-normal text-muted-foreground">/day</span></span>
                    {rv.city && <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{rv.city}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">How RentalHub works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: Search, title: 'Discover & compare', desc: 'Search across categories, filter by price, rating, and distance. Compare up to 3 items side by side.' },
              { icon: CalendarClock, title: 'Book with confidence', desc: 'Real-time availability means once it’s booked, it’s instantly unavailable. Transparent dynamic pricing.' },
              { icon: LifeBuoy, title: 'Track the lifecycle', desc: 'From pickup to return, every rental is tracked. Leave reviews. Owners monitor utilization.' },
            ].map((s, i) => (
              <div key={s.title} className="relative rounded-xl border bg-card p-6">
                <div className="absolute -top-3 left-6 grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-emerald-600 p-8 text-primary-foreground sm:p-12">
          <div className="absolute inset-0 rh-grid-pattern opacity-20" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Own equipment? Start earning.</h2>
              <p className="mt-2 max-w-md text-primary-foreground/90">List your tools, machines, or vehicles. Set dynamic pricing, manage availability, and track maintenance — all in one place.</p>
            </div>
            <Button size="lg" variant="secondary" onClick={() => navigate('register', { role: 'owner' })} className="shrink-0">
              Become an owner <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, suffix = '', decimals = 0 }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; suffix?: string; decimals?: number }) {
  const animated = useCountUp(value)
  const display = decimals > 0 ? animated.toFixed(decimals) : String(Math.round(animated))
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:shadow-md">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{display}{suffix}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function TrendingSection() {
  const navigate = useRouterStore((s) => s.navigate)
  const { data: trending, isLoading } = useQuery<EquipmentListItem[]>({
    queryKey: ['equipment', 'trending'],
    queryFn: () => apiFns.trendingEquipment(8),
  })

  if (!isLoading && (!trending || trending.length === 0)) return null

  return (
    <section className="border-t bg-gradient-to-b from-primary/5 to-transparent">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Flame className="h-6 w-6 text-orange-500" />
              Trending now
            </h2>
            <p className="text-sm text-muted-foreground">Most-wishlisted equipment this week</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('search', { sort: 'rating' })}>Browse all <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
        {isLoading ? (
          <CardGridSkeleton count={8} />
        ) : (
          <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trending!.map((item, i) => (
              <div key={item.id} className="relative">
                {i < 3 && (
                  <span className="absolute -left-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-xs font-bold text-white shadow-lg">
                    #{i + 1}
                  </span>
                )}
                <EquipmentCard item={item as EquipmentListItem} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Rahul Das',
      role: 'Construction Contractor',
      avatar: 'R',
      rating: 5,
      quote: 'RentalHub saved us weeks of waiting. We found a mini excavator nearby, booked it for 3 days, and had it delivered the same afternoon. The dynamic pricing saved us 15% on a weekly rental.',
      location: 'Mumbai',
    },
    {
      name: 'Priya Nair',
      role: 'Event Planner',
      avatar: 'P',
      rating: 5,
      quote: 'As an event planner, I rent tents, tables, and PA systems regularly. The compare feature is a game-changer — I can see prices and specs side by side before booking. Real-time availability means no more double-booking.',
      location: 'Pune',
    },
    {
      name: 'Karan Mehta',
      role: 'Equipment Owner',
      avatar: 'K',
      rating: 5,
      quote: 'I listed my construction equipment on RentalHub and started earning within a week. The owner dashboard shows me exactly which listings perform best and my projected monthly revenue. The maintenance tracking keeps everything organized.',
      location: 'Delhi',
    },
  ]

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Loved by renters and owners</h2>
        <p className="mt-1 text-sm text-muted-foreground">See what our community says about RentalHub</p>
      </div>
      <div className="grid gap-4 rh-stagger md:grid-cols-3">
        {testimonials.map((t, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <Quote className="absolute -right-2 -top-2 h-16 w-16 text-primary/5" />
            <div className="relative">
              <div className="mb-3 flex">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} className={j < t.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/40'} />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-3 border-t pt-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role} · {t.location}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
