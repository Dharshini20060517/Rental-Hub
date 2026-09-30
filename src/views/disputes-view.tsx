'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { AlertCircle, ChevronRight, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/format'

const REASON_LABELS: Record<string, string> = {
  damage: 'Equipment damage', late_return: 'Late return', wrong_item: 'Wrong item', payment: 'Payment issue', other: 'Other',
}

export function DisputesView() {
  const navigate = useRouterStore((s) => s.navigate)

  const { data, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => apiFns.listDisputes({ limit: 50 }),
  })

  const disputes = (data as unknown as { id: string; reason: string; status: string; description: string; createdAt: string; booking: { id: string; equipment: { title: string; images: { url: string }[] } }; raisedBy: { name: string }; _count: { messages: number } }[]) || []

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Disputes</h1>
      <p className="mb-6 text-sm text-muted-foreground">Manage and track your disputes</p>

      {isLoading ? <CardGridSkeleton count={2} /> : disputes.length === 0 ? (
        <EmptyState title="No disputes" description="Disputes will appear here when they are raised." icon={AlertCircle} />
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <button key={d.id} onClick={() => navigate('dispute-detail', { id: d.id })} className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{REASON_LABELS[d.reason] || d.reason}</p>
                <p className="truncate text-xs text-muted-foreground">{d.booking.equipment.title} · {formatDate(d.createdAt)}</p>
                <p className="truncate text-xs text-muted-foreground/70">Raised by {d.raisedBy.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  d.status === 'open' ? 'bg-rose-500/10 text-rose-600' :
                  d.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>{d.status.replace(/_/g, ' ')}</span>
                {d._count.messages > 0 && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><MessageSquare className="h-3 w-3" /> {d._count.messages}</span>}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
