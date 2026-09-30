'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { AlertCircle, ChevronRight, Scale } from 'lucide-react'
import { formatDate } from '@/lib/format'

export function AdminDisputesView() {
  const navigate = useRouterStore((s) => s.navigate)

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', 'admin'],
    queryFn: () => apiFns.listDisputes({ limit: 50 }),
  })

  const disputes = (data as unknown as { id: string; reason: string; status: string; description: string; createdAt: string; booking: { id: string; equipment: { title: string } }; raisedBy: { name: string }; against: { name: string }; _count: { messages: number } }[]) || []

  const openCount = disputes.filter(d => d.status !== 'resolved' && d.status !== 'closed').length

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><Scale className="h-6 w-6 text-primary" /> Disputes console</h1>
      <p className="mb-6 text-sm text-muted-foreground">{openCount} open · {disputes.length} total</p>

      {isLoading ? <CardGridSkeleton count={2} /> : disputes.length === 0 ? <EmptyState title="No disputes" icon={Scale} /> : (
        <div className="space-y-3">
          {disputes.map(d => (
            <button key={d.id} onClick={() => navigate('dispute-detail', { id: d.id })} className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-600"><AlertCircle className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium capitalize">{d.reason.replace(/_/g, ' ')} — {d.booking.equipment.title}</p>
                <p className="text-xs text-muted-foreground">{d.raisedBy.name} vs {d.against.name} · {formatDate(d.createdAt)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${d.status === 'open' ? 'bg-rose-500/10 text-rose-600' : d.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{d.status.replace(/_/g, ' ')}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
