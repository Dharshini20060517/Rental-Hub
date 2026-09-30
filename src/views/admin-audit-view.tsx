'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFns } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { ScrollText, Search, UserPlus, LogIn, LogOut, UserCog, Package, FileEdit, Trash2, Check, X, FolderPlus, FolderEdit, FolderX, Image, ShieldCheck, Wrench } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

type Log = { id: string; action: string; resource: string; resourceId: string | null; actorId: string | null; metadata: unknown; ip: string | null; createdAt: string }

export function AdminAuditView() {
  const [action, setAction] = useState<string>('all')
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery<{ rows: Log[]; total: number }>({
    queryKey: ['audit-logs', action, q],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/admin/audit-logs', { params: { limit: 100, action: action === 'all' ? undefined : action } })
      const rows = (res.data.data || []) as Log[]
      const filtered = q ? rows.filter((r) => r.action.toLowerCase().includes(q.toLowerCase()) || r.resource.toLowerCase().includes(q.toLowerCase())) : rows
      return { rows: filtered, total: res.data.meta?.total ?? 0 }
    },
  })

  const rows = data?.rows || []
  const actionTypes = ['USER_LOGIN', 'USER_REGISTERED', 'USER_LOGOUT', 'USER_UPDATED_BY_ADMIN', 'PROFILE_UPDATED', 'LISTING_CREATED', 'LISTING_UPDATED', 'LISTING_DELETED', 'LISTING_APPROVED', 'LISTING_REJECTED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DELETED', 'AVATAR_UPDATED']

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ScrollText className="h-6 w-6 text-primary" /> Audit log</h1>
        <p className="text-sm text-muted-foreground">Sensitive actions across the platform</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action / resource…" className="pl-9" />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All actions</SelectItem>
            {actionTypes.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <CardGridSkeleton count={4} /> : rows.length === 0 ? <EmptyState title="No audit entries" icon={ScrollText} /> : (
        <div className="max-h-[70vh] overflow-y-auto rh-scroll rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Resource</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const actionColor = getActionColor(l.action)
                return (
                  <tr key={l.id} className="border-b transition last:border-0 hover:bg-primary/5">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${actionColor.cls}`}>
                        {l.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <actionColor.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{l.resource}</span>
                        {l.resourceId && <span className="text-xs text-muted-foreground">#{l.resourceId.slice(-6)}</span>}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">{l.ip || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function getActionColor(action: string): { cls: string; icon: React.ComponentType<{ className?: string }> } {
  const a = action.toUpperCase()
  if (a.includes('LOGIN') || a.includes('LOGOUT')) return { cls: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400', icon: LogIn }
  if (a.includes('REGISTERED')) return { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: UserPlus }
  if (a.includes('APPROVED')) return { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: Check }
  if (a.includes('REJECTED')) return { cls: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400', icon: X }
  if (a.includes('DELETED')) return { cls: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400', icon: Trash2 }
  if (a.includes('CREATED') || a.includes('ADDED')) return { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: Package }
  if (a.includes('UPDATED') || a.includes('MODERATED')) return { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: FileEdit }
  if (a.includes('AVATAR') || a.includes('IMAGE')) return { cls: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400', icon: Image }
  if (a.includes('MAINTENANCE')) return { cls: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400', icon: Wrench }
  if (a.includes('PASSWORD')) return { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: ShieldCheck }
  return { cls: 'border-border bg-muted text-muted-foreground', icon: ScrollText }
}
