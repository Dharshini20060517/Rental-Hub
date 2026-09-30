'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { Package, Users, Star, Heart, BarChart3, ShieldAlert, ScrollText, TrendingUp, Crown, Gauge } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

const PIE_COLORS = ['oklch(0.48 0.12 162)', 'oklch(0.7 0.18 70)', 'oklch(0.65 0.22 16)', 'oklch(0.5 0.2 264)', 'oklch(0.6 0.18 184)']

export function AdminStatsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiFns.adminStats(),
  })
  const { data: revenueData } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => apiFns.adminRevenue(),
  })
  const { data: growthData } = useQuery({
    queryKey: ['admin-growth'],
    queryFn: () => apiFns.adminGrowth(),
  })
  const { data: overviewData } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFns.adminOverview(),
  })

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><CardGridSkeleton count={2} /></div>
  if (!data) return null

  const stats = data as {
    totals: { users: number; equipment: number; reviews: number; avgRating: number; auditLast7d: number; wishlists: number }
    usersByRole: { role: string; count: number }[]
    equipmentByStatus: { status: string; count: number }[]
    equipmentByCategory: { categoryId: string; name: string; count: number }[]
  }

  const cards = [
    { label: 'Total users', value: stats.totals.users, icon: Users, color: 'text-primary' },
    { label: 'Equipment', value: stats.totals.equipment, icon: Package, color: 'text-emerald-600' },
    { label: 'Reviews', value: stats.totals.reviews, icon: Star, color: 'text-amber-500' },
    { label: 'Avg. rating', value: stats.totals.avgRating.toFixed(1), icon: Star, color: 'text-amber-500' },
    { label: 'Wishlists', value: stats.totals.wishlists, icon: Heart, color: 'text-rose-500' },
    { label: 'Audit (7d)', value: stats.totals.auditLast7d, icon: ScrollText, color: 'text-muted-foreground' },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BarChart3 className="h-6 w-6 text-primary" /> Platform analytics</h1>
        <p className="text-sm text-muted-foreground">Live counts & distributions (adapted from MongoDB aggregations to Prisma groupBy)</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="group rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30">
            <div className="transition-transform duration-300 group-hover:scale-110">
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Equipment by category */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Listings by category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.equipmentByCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip cursor={{ fill: 'oklch(0.48 0.12 162 / 0.1)' }} />
                <Bar dataKey="count" fill="oklch(0.48 0.12 162)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Equipment by status */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Listings by status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.equipmentByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} innerRadius={45} label>
                  {stats.equipmentByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Users by role */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Users by role</h2>
          <div className="flex flex-wrap gap-3">
            {stats.usersByRole.map((u, i) => (
              <div key={u.role} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3" style={{ flex: '1 1 180px' }}>
                <div className="h-10 w-1.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div>
                  <p className="text-2xl font-bold">{u.count}</p>
                  <p className="text-xs capitalize text-muted-foreground">{u.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform health overview */}
      {overviewData && (
        <div className="mt-6 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Gauge className="h-5 w-5 text-primary" /> Platform health overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Avg health score', value: `${(overviewData as { avgHealthScore: number }).avgHealthScore}/100`, sub: 'across all listings', color: 'text-primary' },
              { label: 'Platform utilization', value: `${(overviewData as { platformUtilization: number }).platformUtilization}%`, sub: 'est. active rentals', color: 'text-emerald-600' },
              { label: 'Active rate', value: `${(overviewData as { activeRate: number }).activeRate}%`, sub: 'of total listings', color: 'text-sky-600' },
              { label: 'Avg listing price', value: `₹${(overviewData as { avgListingPrice: number }).avgListingPrice}`, sub: 'per day', color: 'text-amber-600' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border bg-card p-3">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-[10px] text-muted-foreground/70">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Quality metrics progress bars */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Location coverage', value: (overviewData as { locationCoverage: number }).locationCoverage },
              { label: 'Dynamic pricing adoption', value: (overviewData as { pricingRulesCoverage: number }).pricingRulesCoverage },
              { label: 'Image quality (3+ images)', value: (overviewData as { imageQualityRate: number }).imageQualityRate },
              { label: 'Spec completeness (3+ specs)', value: (overviewData as { specCompletenessRate: number }).specCompletenessRate },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium">{m.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${m.value >= 70 ? 'bg-emerald-500' : m.value >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Health grade distribution */}
          <div className="mt-4 flex items-center gap-3 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">Health grades:</span>
            {(['A', 'B', 'C', 'D'] as const).map((g) => {
              const count = (overviewData as { gradeDistribution: Record<string, number> }).gradeDistribution[g] || 0
              const colorClass = g === 'A' ? 'bg-emerald-500/15 text-emerald-600' : g === 'B' ? 'bg-sky-500/15 text-sky-600' : g === 'C' ? 'bg-amber-500/15 text-amber-600' : 'bg-rose-500/15 text-rose-600'
              return (
                <span key={g} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${colorClass}`}>
                  {g}: {count}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Growth trend */}
      {growthData && (growthData as { months: unknown[] }).months.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* User growth */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary" /> User growth</h2>
                <p className="text-xs text-muted-foreground">New registrations per month</p>
              </div>
              {(growthData as { growthRates: { users: number } }).growthRates.users !== 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${(growthData as { growthRates: { users: number } }).growthRates.users > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                  <TrendingUp className="h-3 w-3" />
                  {(growthData as { growthRates: { users: number } }).growthRates.users > 0 ? '+' : ''}{(growthData as { growthRates: { users: number } }).growthRates.users}%
                </span>
              )}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(growthData as { months: { label: string; users: number }[] }).months} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="users" fill="oklch(0.48 0.12 162)" radius={[6, 6, 0, 0]} name="New users" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Equipment growth */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><Package className="h-5 w-5 text-emerald-500" /> Equipment growth</h2>
                <p className="text-xs text-muted-foreground">New listings per month</p>
              </div>
              {(growthData as { growthRates: { equipment: number } }).growthRates.equipment !== 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${(growthData as { growthRates: { equipment: number } }).growthRates.equipment > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                  <TrendingUp className="h-3 w-3" />
                  {(growthData as { growthRates: { equipment: number } }).growthRates.equipment > 0 ? '+' : ''}{(growthData as { growthRates: { equipment: number } }).growthRates.equipment}%
                </span>
              )}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(growthData as { months: { label: string; equipment: number }[] }).months} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="equipment" fill="oklch(0.65 0.18 142)" radius={[6, 6, 0, 0]} name="New listings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Revenue trend */}
      {revenueData && (revenueData as { months: unknown[] }).months.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-5 w-5 text-emerald-500" /> Platform revenue trend</h2>
                <p className="text-xs text-muted-foreground">Projected monthly revenue · last 6 months</p>
              </div>
              <span className="text-lg font-bold text-emerald-600">{formatCurrency((revenueData as { totalProjectedMonthly: number }).totalProjectedMonthly)}</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(revenueData as { months: { label: string; revenue: number }[] }).months} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 142)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 142)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(0.65 0.18 142)" strokeWidth={2} fill="url(#adminRevGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top owners by revenue */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><Crown className="h-5 w-5 text-amber-500" /> Top owners by revenue</h2>
            <div className="space-y-2">
              {(revenueData as { topOwners: { id: string; name: string; avatarUrl: string | null; isVerified: boolean; listingCount: number; projectedRevenue: number }[] }).topOwners.map((o, i) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}>#{i + 1}</span>
                  <Avatar className="h-8 w-8">
                    {o.avatarUrl && <AvatarImage src={o.avatarUrl} alt="" />}
                    <AvatarFallback className="text-[10px]">{o.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.listingCount} listings</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-emerald-600">{formatCurrency(o.projectedRevenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
        <ShieldAlert className="h-5 w-5 text-primary" />
        Actual booking revenue & utilization analytics arrive in Phase 2. Projections shown above are based on listing pricing and estimated utilization.
      </div>
    </div>
  )
}
