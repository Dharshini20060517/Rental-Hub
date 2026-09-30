'use client'

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: string; icon?: React.ComponentType<{ className?: string }>; action?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
      {/* Decorative dotted pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10">
        <Icon className="h-7 w-7" />
      </div>
      <div className="relative">
        <p className="font-semibold">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="relative">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium text-destructive">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
        </Button>
      )}
    </div>
  )
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    draft: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
    paused: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    rejected: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
    published: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    flagged: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  }
  const cls = map[status] || 'bg-muted text-muted-foreground border-border'
  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize', cls, className)}>{status}</span>
}
