'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Package, MapPin, ChevronRight, CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending', color: 'text-slate-500 bg-slate-500/10', icon: Clock },
  held: { label: 'On hold', color: 'text-amber-600 bg-amber-500/10', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle2 },
  picked_up: { label: 'Picked up', color: 'text-sky-600 bg-sky-500/10', icon: Package },
  in_use: { label: 'In use', color: 'text-primary bg-primary/10', icon: Package },
  return_pending: { label: 'Return pending', color: 'text-amber-600 bg-amber-500/10', icon: Clock },
  returned: { label: 'Returned', color: 'text-sky-600 bg-sky-500/10', icon: CheckCircle2 },
  inspected: { label: 'Inspected', color: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-rose-600 bg-rose-500/10', icon: XCircle },
  late: { label: 'Late', color: 'text-rose-600 bg-rose-500/10', icon: AlertCircle },
  disputed: { label: 'Disputed', color: 'text-rose-600 bg-rose-500/10', icon: AlertCircle },
}

export function MyRentalsView() {
  const navigate = useRouterStore((s) => s.navigate)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', 'customer', statusFilter],
    queryFn: () => apiFns.listBookings({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 }),
  })

  const bookings = (data as unknown as { id: string; status: string; startDate: string; endDate: string; days: number; totalAmount: number; depositAmount: number; equipment: { id: string; title: string; city: string | null; images: { url: string; isPrimary: boolean }[] }; owner: { name: string | null; businessName: string | null } }[]) || []

  // Quick stats
  const stats = {
    total: bookings.length,
    active: bookings.filter(b => ['confirmed', 'picked_up', 'in_use', 'return_pending'].includes(b.status)).length,
    completed: bookings.filter(b => b.status === 'completed').length,
    totalSpent: bookings.filter(b => b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0),
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">My rentals</h1>
      <p className="mb-6 text-sm text-muted-foreground">Track your bookings and rental lifecycle</p>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total bookings', value: stats.total, icon: Calendar, color: 'text-primary' },
          { label: 'Active', value: stats.active, icon: Clock, color: 'text-amber-600' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Total spent', value: formatCurrency(stats.totalSpent), icon: Package, color: 'text-sky-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <p className="mt-2 text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bookings</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="picked_up">Picked up</SelectItem>
            <SelectItem value="in_use">In use</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <CardGridSkeleton count={3} /> : bookings.length === 0 ? (
        <EmptyState title="No bookings yet" description="Browse equipment and make your first booking." icon={Calendar} action={<Button onClick={() => navigate('search')}>Browse equipment</Button>} />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const config = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending
            const Icon = config.icon
            return (
              <button
                key={b.id}
                onClick={() => navigate('booking-detail', { id: b.id })}
                className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {b.equipment.images[0] && (
                     
                    <img src={b.equipment.images[0].url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.equipment.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(b.startDate)} → {formatDate(b.endDate)}</span>
                    <span>·</span>
                    <span>{b.days} day{b.days !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{b.owner.businessName || b.owner.name || 'Owner'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
                    <Icon className="h-3 w-3" /> {config.label}
                  </span>
                  <span className="font-bold text-primary">{formatCurrency(b.totalAmount)}</span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
