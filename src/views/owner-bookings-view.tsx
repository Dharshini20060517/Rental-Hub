'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, ChevronRight, Package, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

export function OwnerBookingsView() {
  const navigate = useRouterStore((s) => s.navigate)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', 'owner', statusFilter],
    queryFn: () => apiFns.listBookings({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 }),
  })

  const bookings = (data as unknown as { id: string; status: string; startDate: string; endDate: string; days: number; totalAmount: number; equipment: { id: string; title: string; images: { url: string; isPrimary: boolean }[] }; customer: { name: string; avatarUrl: string | null }; _count: { messages: number; disputes: number } }[]) || []

  const pendingApprovals = bookings.filter(b => b.status === 'held').length

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Booking requests</h1>
          <p className="text-sm text-muted-foreground">{pendingApprovals > 0 ? `${pendingApprovals} awaiting approval` : 'All bookings managed'}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('owner-calendar')}>Master calendar</Button>
      </div>

      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bookings</SelectItem>
            <SelectItem value="held">Pending approval</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="picked_up">Picked up</SelectItem>
            <SelectItem value="in_use">In use</SelectItem>
            <SelectItem value="return_pending">Return pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <CardGridSkeleton count={3} /> : bookings.length === 0 ? (
        <EmptyState title="No bookings" icon={Calendar} />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <button key={b.id} onClick={() => navigate('booking-detail', { id: b.id })} className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {b.equipment.images[0] && (
                   
                  <img src={b.equipment.images[0].url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.equipment.title}</p>
                <p className="text-xs text-muted-foreground">{b.customer.name} · {formatDate(b.startDate)} → {formatDate(b.endDate)}</p>
                {b._count.messages > 0 && <p className="text-[10px] text-muted-foreground/70">{b._count.messages} messages</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  b.status === 'held' ? 'bg-amber-500/10 text-amber-600' :
                  b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                  b.status === 'cancelled' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-sky-500/10 text-sky-600'
                }`}>{b.status.replace(/_/g, ' ')}</span>
                <span className="font-bold text-primary">{formatCurrency(b.totalAmount)}</span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
