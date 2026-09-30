'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { TrendingUp, DollarSign, Calendar, BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts'

export function AdminAnalyticsView() {
  const { data: revenueData, isLoading } = useQuery({ queryKey: ['analytics-revenue', 'admin'], queryFn: () => apiFns.analyticsRevenue({ months: '12' }) })
  const { data: patternsData } = useQuery({ queryKey: ['analytics-patterns', 'admin'], queryFn: () => apiFns.analyticsPatterns() })
  const { data: leaderboardData } = useQuery({ queryKey: ['analytics-leaderboard'], queryFn: () => apiFns.analyticsLeaderboard() })

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><CardGridSkeleton count={3} /></div>

  const revenue = revenueData as { months: { label: string; revenue: number; commission: number; bookings: number }[]; totals: { revenue: number; commission: number; bookings: number; avgPerBooking: number } } | undefined
  const patterns = patternsData as { weekday: { label: string; bookings: number }[]; avgDuration: number; cancellationRate: number; repeatRate: number; totalBookings: number; cancelReasons: { reason: string; count: number }[] } | undefined
  const leaderboard = leaderboardData as { leaderboard: { name: string; businessName: string | null; revenue: number; bookings: number }[]; roiData: { title: string; revenue: number; roi: number; bookingCount: number }[] } | undefined

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Platform analytics</h1>
      <p className="mb-6 text-sm text-muted-foreground">Revenue, patterns, and ROI insights (12-month history)</p>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total revenue', value: formatCurrency(revenue?.totals.revenue || 0), icon: DollarSign, color: 'text-emerald-600' },
          { label: 'Commission', value: formatCurrency(revenue?.totals.commission || 0), icon: TrendingUp, color: 'text-primary' },
          { label: 'Total bookings', value: String(revenue?.totals.bookings || 0), icon: Calendar, color: 'text-sky-600' },
          { label: 'Avg / booking', value: formatCurrency(revenue?.totals.avgPerBooking || 0), icon: BarChart3, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border bg-card p-4">
            <k.icon className={`h-5 w-5 ${k.color}`} />
            <p className="mt-2 text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="mb-6 rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Revenue trend (12 months)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenue?.months || []}>
              <defs><linearGradient id="revG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="oklch(0.65 0.18 142)" stopOpacity={0.3} /><stop offset="95%" stopColor="oklch(0.65 0.18 142)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v/1000)}k` : v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.65 0.18 142)" strokeWidth={2} fill="url(#revG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weekday patterns */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Bookings by weekday</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={patterns?.weekday || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="oklch(0.48 0.12 162)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Owner leaderboard */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Top owners by revenue</h2>
          <div className="space-y-2">
            {(leaderboard?.leaderboard || []).slice(0, 5).map((o, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}>#{i+1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.businessName || o.name}</p>
                  <p className="text-xs text-muted-foreground">{o.bookings} bookings</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(o.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patterns summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3"><p className="text-lg font-bold">{patterns?.avgDuration || 0}d</p><p className="text-xs text-muted-foreground">Avg duration</p></div>
        <div className="rounded-xl border bg-card p-3"><p className="text-lg font-bold">{patterns?.cancellationRate || 0}%</p><p className="text-xs text-muted-foreground">Cancellation rate</p></div>
        <div className="rounded-xl border bg-card p-3"><p className="text-lg font-bold">{patterns?.repeatRate || 0}%</p><p className="text-xs text-muted-foreground">Repeat customer rate</p></div>
        <div className="rounded-xl border bg-card p-3"><p className="text-lg font-bold">{patterns?.totalBookings || 0}</p><p className="text-xs text-muted-foreground">Total bookings</p></div>
      </div>
    </div>
  )
}
