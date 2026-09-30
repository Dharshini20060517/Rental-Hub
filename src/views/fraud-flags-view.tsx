'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { ShieldAlert, AlertCircle } from 'lucide-react'

export function FraudFlagsView() {
  const { data, isLoading } = useQuery({ queryKey: ['fraud-flags'], queryFn: () => apiFns.getFraudFlags() })

  const flagsData = data as { flags: { type: string; severity: string; description: string; userId?: string; bookingId?: string }[]; totalFlags: number } | undefined

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-8"><CardGridSkeleton count={2} /></div>

  const flags = flagsData?.flags || []
  const highCount = flags.filter(f => f.severity === 'high').length
  const mediumCount = flags.filter(f => f.severity === 'medium').length

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldAlert className="h-6 w-6 text-rose-500" /> Fraud & anomaly flags</h1>
      <p className="mb-6 text-sm text-muted-foreground">{flagsData?.totalFlags || 0} total · {highCount} high · {mediumCount} medium</p>

      {flags.length === 0 ? <EmptyState title="No fraud flags" description="All clear — no suspicious activity detected." icon={ShieldAlert} /> : (
        <div className="space-y-3">
          {flags.map((f, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border p-4 ${
              f.severity === 'high' ? 'border-rose-500/30 bg-rose-500/5' :
              f.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/5' :
              'border-border bg-card'
            }`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                f.severity === 'high' ? 'bg-rose-500/10 text-rose-600' :
                f.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' :
                'bg-muted text-muted-foreground'
              }`}>
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{f.type.replace(/_/g, ' ')}</p>
                <p className="text-sm text-muted-foreground">{f.description}</p>
                {f.userId && <p className="mt-0.5 text-xs text-muted-foreground/70">User: {f.userId.slice(-8)}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                f.severity === 'high' ? 'bg-rose-500/15 text-rose-600' :
                f.severity === 'medium' ? 'bg-amber-500/15 text-amber-600' :
                'bg-muted text-muted-foreground'
              }`}>{f.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
