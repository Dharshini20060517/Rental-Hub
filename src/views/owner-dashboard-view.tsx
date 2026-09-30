'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { RatingStars } from '@/components/shared/rating-stars'
import { StatusBadge } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Heart, Star, Wrench, TrendingUp, Eye, ArrowRight, Plus, IndianRupee, CalendarClock, BarChart3, Activity } from 'lucide-react'
import { formatCurrency, formatDate, timeAgo } from '@/lib/format'
import { gradeColor } from '@/lib/health-score'
import { HealthTipsCard } from '@/components/equipment/health-tips-card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  active: 'oklch(0.65 0.18 142)',
  draft: 'oklch(0.6 0.02 250)',
  paused: 'oklch(0.75 0.18 70)',
  rejected: 'oklch(0.62 0.22 16)',
}

type ActivityItem = {
  id: string
  type: 'wishlist' | 'review' | 'maintenance' | 'listing'
  title: string
  description: string
  timestamp: string
  equipmentId?: string
  equipmentTitle?: string
  metadata?: unknown
}

export function OwnerDashboardView() {
  const navigate = useRouterStore((s) => s.navigate)
  const { data, isLoading } = useQuery({ queryKey: ['owner-stats'], queryFn: () => apiFns.ownerStats() })
  const { data: revenueData } = useQuery({ queryKey: ['owner-revenue'], queryFn: () => apiFns.ownerRevenue() })
  const { data: activityData } = useQuery({ queryKey: ['owner-activity'], queryFn: () => apiFns.ownerActivity() })

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><CardGridSkeleton count={3} /></div>

  const stats = data as {
    totals: {
      listings: number; activeListings: number; totalWishlists: number; totalReviews: number;
      avgRating: number; totalMaintenanceCost: number; maintenanceCount: number; potentialMonthlyRevenue: number
    }
    byStatus: { status: string; count: number }[]
    topListings: {
      id: string; title: string; status: string; baseDailyPrice: number; city: string | null;
      coverUrl: string | null; wishlists: number; reviews: number; rating: number; reviewCount: number; maintenanceLogs: number;
      healthScore?: number; healthGrade?: 'A' | 'B' | 'C' | 'D'; healthChecks?: unknown[]
    }[]
    recentMaintenance: { id: string; title: string; cost: number; performedAt: string; equipmentTitle: string }[]
  }

  if (stats.totals.listings === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Owner dashboard</h1>
        <EmptyState
          title="No listings yet"
          description="Create your first listing to see analytics here."
          icon={Package}
          action={<Button onClick={() => navigate('listing-form')}><Plus className="mr-1.5 h-4 w-4" /> Create listing</Button>}
        />
      </div>
    )
  }

  const kpis = [
    { label: 'Total listings', value: String(stats.totals.listings), sub: `${stats.totals.activeListings} active`, icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Avg. rating', value: stats.totals.avgRating.toFixed(1), sub: `${stats.totals.totalReviews} reviews`, icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Wishlist saves', value: String(stats.totals.totalWishlists), sub: 'across all listings', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Maintenance cost', value: formatCurrency(stats.totals.totalMaintenanceCost), sub: `${stats.totals.maintenanceCount} logs`, icon: Wrench, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { label: 'Est. monthly revenue', value: formatCurrency(stats.totals.potentialMonthlyRevenue), sub: 'at 20 days/mo utilization', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
    { label: 'Active rate', value: `${Math.round((stats.totals.activeListings / stats.totals.listings) * 100)}%`, sub: 'of total listings', icon: Eye, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Owner dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your portfolio performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('owner-listings')}><Package className="mr-1.5 h-4 w-4" /> View listings</Button>
          <Button onClick={() => navigate('listing-form')}><Plus className="mr-1.5 h-4 w-4" /> New listing</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

      {/* Health improvement tips */}
      {stats.topListings.length > 0 && (
        <HealthTipsCard listings={stats.topListings as never} />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Top performing listings */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Top performing listings</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('owner-listings')}>View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topListings.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate('equipment', { id: item.id })}
                className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.coverUrl ? (
                     
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={item.status} />
                    <span>{formatCurrency(item.baseDailyPrice)}/day</span>
                    {item.city && <span>· {item.city}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {item.healthScore !== undefined && (
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${gradeColor(item.healthGrade)}`}>
                      {item.healthGrade} · {item.healthScore}
                    </span>
                  )}
                  <RatingStars rating={item.rating} size={11} showValue={false} />
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3" /> {item.wishlists}</span>
                    <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3" /> {item.reviewCount}</span>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Listing status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={75} innerRadius={40} label={(e: { status: string }) => e.status}>
                    {stats.byStatus.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] || 'oklch(0.6 0.02 250)'} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-3 text-xs">
              {stats.byStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] || 'oklch(0.6 0.02 250)' }} />
                  <span className="capitalize">{s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity feed */}
      {activityData && (activityData as ActivityItem[]).length > 0 && (
        <Card className="mt-4 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(activityData as ActivityItem[]).slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border bg-card p-2.5">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    item.type === 'wishlist' ? 'bg-rose-500/10 text-rose-500' :
                    item.type === 'review' ? 'bg-amber-500/10 text-amber-500' :
                    item.type === 'maintenance' ? 'bg-sky-500/10 text-sky-500' :
                    'bg-primary/10 text-primary'
                  }`}>
                    {item.type === 'wishlist' ? <Heart className="h-4 w-4" /> :
                     item.type === 'review' ? <Star className="h-4 w-4" /> :
                     item.type === 'maintenance' ? <Wrench className="h-4 w-4" /> :
                     <Package className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/70">{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent maintenance */}
      <Card className="mt-4 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Recent maintenance</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('owner-listings')}>All logs <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
        </CardHeader>
        <CardContent>
          {stats.recentMaintenance.length === 0 ? (
            <EmptyState title="No maintenance logged" icon={Wrench} />
          ) : (
            <div className="space-y-2">
              {stats.recentMaintenance.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-500">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.equipmentTitle} · {timeAgo(m.performedAt)}</p>
                  </div>
                  {m.cost > 0 && (
                    <span className="shrink-0 text-sm font-semibold text-muted-foreground">{formatCurrency(m.cost)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue trend chart */}
      {revenueData && (revenueData as { months: { month: string; revenue: number; label: string }[] }).months.length > 0 && (
        <Card className="mt-4 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Revenue trend (6 months)</CardTitle>
              <p className="text-xs text-muted-foreground">Projected monthly revenue · avg {(revenueData as { avgMonthly: number }).avgMonthly ? formatCurrency((revenueData as { avgMonthly: number }).avgMonthly) : '—'}</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(revenueData as { months: { label: string; revenue: number }[] }).months} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.48 0.12 162)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.48 0.12 162)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(0.48 0.12 162)" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listing performance table */}
      {revenueData && (revenueData as { performance: unknown[] }).performance.length > 0 && (
        <Card className="mt-4 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Listing performance</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('owner-listings')}>View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rh-scroll">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Listing</th>
                    <th className="px-3 py-2 text-right font-medium">Daily</th>
                    <th className="px-3 py-2 text-right font-medium">Wishlists</th>
                    <th className="px-3 py-2 text-right font-medium">Rating</th>
                    <th className="px-3 py-2 text-right font-medium">Mo. projection</th>
                  </tr>
                </thead>
                <tbody>
                  {(revenueData as { performance: { id: string; title: string; status: string; baseDailyPrice: number; wishlists: number; rating: number; reviewCount: number; monthlyProjection: number }[] }).performance.map((p) => (
                    <tr key={p.id} className="border-b transition last:border-0 hover:bg-primary/5">
                      <td className="px-3 py-2.5">
                        <button onClick={() => navigate('equipment', { id: p.id })} className="flex items-center gap-2 text-left hover:text-primary">
                          <span className="truncate font-medium">{p.title}</span>
                          <StatusBadge status={p.status} />
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(p.baseDailyPrice)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><Heart className="h-3.5 w-3.5" /> {p.wishlists}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <RatingStars rating={p.rating} size={11} showValue count={p.reviewCount} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{formatCurrency(p.monthlyProjection)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
