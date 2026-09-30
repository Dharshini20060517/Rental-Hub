'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

export function AdminBookingsView() {
  const navigate = useRouterStore((s) => s.navigate)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', 'admin', statusFilter],
    queryFn: () => apiFns.listBookings({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 }),
  })

  const bookings = (data as unknown as { id: string; status: string; startDate: string; endDate: string; totalAmount: number; equipment: { title: string; images: { url: string }[] }; customer: { name: string }; owner: { name: string; businessName: string | null } }[]) || []

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">All bookings</h1>
      <p className="mb-6 text-sm text-muted-foreground">{bookings.length} total bookings on the platform</p>

      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="held">Held</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_use">In use</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <CardGridSkeleton count={3} /> : bookings.length === 0 ? <EmptyState title="No bookings" /> : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Equipment</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Owner</th>
                <th className="px-4 py-2.5 font-medium">Dates</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b transition last:border-0 hover:bg-primary/5 cursor-pointer" onClick={() => navigate('booking-detail', { id: b.id })}>
                  <td className="px-4 py-2.5"><span className="font-medium">{b.equipment.title}</span></td>
                  <td className="px-4 py-2.5">{b.customer.name}</td>
                  <td className="px-4 py-2.5">{b.owner.businessName || b.owner.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(b.startDate)} → {formatDate(b.endDate)}</td>
                  <td className="px-4 py-2.5"><span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{b.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-2.5 font-bold">{formatCurrency(b.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
