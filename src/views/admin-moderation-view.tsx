'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState, StatusBadge } from '@/components/shared/feedback'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ClipboardList, Check, X, Eye, Clock, Pause } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'

type Row = {
  id: string; title: string; status: string; city: string | null; baseDailyPrice: number; createdAt: string;
  category: { name: string }; owner: { name: string | null; businessName: string | null; email: string }
  images: { url: string; isPrimary: boolean }[]
}

export function AdminModerationView() {
  const qc = useQueryClient()
  const navigate = useRouterStore((s) => s.navigate)
  const [status, setStatus] = useState<string>('all')
  const [rejectTarget, setRejectTarget] = useState<Row | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ rows: Row[]; total: number }>({
    queryKey: ['admin-equipment', status],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/admin/equipment', { params: { limit: 50, status: status === 'all' ? undefined : status } })
      return { rows: (res.data.data || []) as Row[], total: res.data.meta?.total ?? 0 }
    },
  })

  // Fetch counts per status for summary cards
  const { data: allCounts } = useQuery<Record<string, number>>({
    queryKey: ['admin-equipment', 'counts'],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/admin/equipment', { params: { limit: 200 } })
      const all = (res.data.data || []) as Row[]
      const counts: Record<string, number> = { draft: 0, active: 0, paused: 0, rejected: 0 }
      all.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1 })
      return counts
    },
  })

  async function moderate(row: Row, action: 'approve' | 'reject') {
    setBusy(row.id)
    try {
      if (action === 'reject') { setRejectTarget(row); return }
      await apiFns.adminModerate(row.id, 'approve')
      qc.invalidateQueries({ queryKey: ['admin-equipment', status] })
      toast.success('Listing approved')
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusy(null) }
  }

  async function confirmReject() {
    if (!rejectTarget) return
    setBusy(rejectTarget.id)
    try {
      await apiFns.adminModerate(rejectTarget.id, 'reject', notes)
      qc.invalidateQueries({ queryKey: ['admin-equipment', status] })
      toast.success('Listing rejected')
      setRejectTarget(null); setNotes('')
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusy(null) }
  }

  const rows = data?.rows || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ClipboardList className="h-6 w-6 text-primary" /> Moderation queue</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} listings · approve or reject</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary stat cards */}
      {allCounts && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { key: 'draft', label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
            { key: 'active', label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-600/10', icon: Check },
            { key: 'paused', label: 'Paused', color: 'text-slate-500', bg: 'bg-slate-500/10', icon: Pause },
            { key: 'rejected', label: 'Rejected', color: 'text-rose-600', bg: 'bg-rose-500/10', icon: X },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(status === s.key ? 'all' : s.key)}
              className={`group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                status === s.key ? 'border-primary ring-1 ring-primary/20' : 'hover:border-primary/30'
              }`}
            >
              <div className={`grid h-9 w-9 place-items-center rounded-lg ${s.bg} transition-transform duration-300 group-hover:scale-110`}>
                <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{allCounts[s.key] || 0}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isLoading ? <CardGridSkeleton count={3} /> : rows.length === 0 ? <EmptyState title="No listings in this view" icon={ClipboardList} /> : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {r.images[0] && ( 
                  <img src={r.images[0].url} alt="" className="h-full w-full object-cover" />)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.category.name} · {r.city || 'No location'} · {formatCurrency(r.baseDailyPrice)}/day</p>
                <p className="text-xs text-muted-foreground">by {r.owner.businessName || r.owner.name} · {formatDate(r.createdAt)}</p>
              </div>
              <StatusBadge status={r.status} />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => navigate('equipment', { id: r.id })}><Eye className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-emerald-600" disabled={busy === r.id} onClick={() => moderate(r, 'approve')}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                <Button size="sm" variant="outline" className="text-destructive" disabled={busy === r.id} onClick={() => moderate(r, 'reject')}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject listing?</DialogTitle><DialogDescription>Provide a reason. The owner will see this listing as rejected.</DialogDescription></DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Incomplete description, prohibited item…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy === rejectTarget?.id} onClick={confirmReject}>Reject listing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
