'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { TrendingUp, DollarSign, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts'

export function OwnerAnalyticsView() {
  const { data: revenueData, isLoading } = useQuery({ queryKey: ['analytics-revenue', 'owner'], queryFn: () => apiFns.analyticsRevenue({ months: '12' }) })
  const { data: utilizationData } = useQuery({ queryKey: ['analytics-utilization'], queryFn: () => apiFns.analyticsUtilization() })

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><CardGridSkeleton count={2} /></div>

  const revenue = revenueData as { months: { label: string; revenue: number; commission: number; bookings: number }[]; totals: { revenue: number; commission: number; bookings: number } } | undefined
  const utilization = utilizationData as { items: { id: string; title: string; baseDailyPrice: number; bookingCount: number; totalDaysRented: number; utilizationRate: number; potentialRevenue: number }[]; avgUtilization: number } | undefined

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Owner analytics</h1>
      <p className="mb-6 text-sm text-muted-foreground">Your revenue and equipment utilization</p>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4"><DollarSign className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-2xl font-bold">{formatCurrency(revenue?.totals.revenue || 0)}</p><p className="text-xs text-muted-foreground">Total revenue</p></div>
        <div className="rounded-xl border bg-card p-4"><TrendingUp className="h-5 w-5 text-primary" /><p className="mt-2 text-2xl font-bold">{formatCurrency(revenue?.totals.commission || 0)}</p><p className="text-xs text-muted-foreground">Commission paid</p></div>
        <div className="rounded-xl border bg-card p-4"><Package className="h-5 w-5 text-sky-600" /><p className="mt-2 text-2xl font-bold">{revenue?.totals.bookings || 0}</p><p className="text-xs text-muted-foreground">Total bookings</p></div>
        <div className="rounded-xl border bg-card p-4"><TrendingUp className="h-5 w-5 text-amber-600" /><p className="mt-2 text-2xl font-bold">{utilization?.avgUtilization || 0}%</p><p className="text-xs text-muted-foreground">Avg utilization</p></div>
      </div>

      {/* Revenue chart */}
      <div className="mb-6 rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Revenue trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenue?.months || []}>
              <defs><linearGradient id="ownerRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="oklch(0.48 0.12 162)" stopOpacity={0.3} /><stop offset="95%" stopColor="oklch(0.48 0.12 162)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v >= 1000 ? `${Math.round(v/1000)}k` : v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.48 0.12 162)" strokeWidth={2} fill="url(#ownerRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Utilization per item */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Utilization by equipment</h2>
        <div className="space-y-2">
          {(utilization?.items || []).map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm font-medium">{item.title}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700" style={{ width: `${item.utilizationRate}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-sm font-bold">{item.utilizationRate}%</span>
              <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">{item.bookingCount} bk</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
