'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState, ErrorState } from '@/components/shared/feedback'
import { Plus, Wrench, CalendarClock, Trash2, ChevronLeft, Ban, Clock } from 'lucide-react'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export function MaintenanceView() {
  const id = useRouterStore((s) => s.params.id)
  const navigate = useRouterStore((s) => s.navigate)
  const qc = useQueryClient()
  const [open, setOpen] = useState<'log' | 'window' | 'block' | null>(null)

  const { data: item, isLoading } = useQuery({ queryKey: ['equipment', id], queryFn: () => apiFns.getEquipment(id!), enabled: !!id })
  const { data: logs } = useQuery({ queryKey: ['maintenance', id], queryFn: () => apiFns.listMaintenance(id!), enabled: !!id })
  const { data: windows } = useQuery({ queryKey: ['maintenance-windows', id], queryFn: () => apiFns.listMaintenanceWindows(id!), enabled: !!id })
  const { data: blocks } = useQuery({ queryKey: ['availability', id], queryFn: () => apiFns.listAvailability(id!), enabled: !!id })

  const [logForm, setLogForm] = useState({ title: '', description: '', cost: 0 })
  const [winForm, setWinForm] = useState({ start: '', end: '', notes: '' })
  const [blockForm, setBlockForm] = useState({ start: '', end: '', reason: 'owner_blocked' })
  const [busy, setBusy] = useState(false)

  async function addLog(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await apiFns.addMaintenance(id!, logForm)
      qc.invalidateQueries({ queryKey: ['maintenance', id] })
      toast.success('Maintenance logged')
      setLogForm({ title: '', description: '', cost: 0 })
      setOpen(null)
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusy(false) }
  }

  async function addWindow(e: React.FormEvent) {
    e.preventDefault()
    if (!winForm.start || !winForm.end) return toast.error('Pick start and end')
    setBusy(true)
    try {
      await apiFns.addMaintenanceWindow(id!, { startDate: new Date(winForm.start).toISOString(), endDate: new Date(winForm.end).toISOString(), notes: winForm.notes })
      qc.invalidateQueries({ queryKey: ['maintenance-windows', id] })
      qc.invalidateQueries({ queryKey: ['availability', id] })
      toast.success('Maintenance window scheduled')
      setWinForm({ start: '', end: '', notes: '' })
      setOpen(null)
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusy(false) }
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault()
    if (!blockForm.start || !blockForm.end) return toast.error('Pick start and end')
    setBusy(true)
    try {
      await apiFns.blockAvailability(id!, { startDate: new Date(blockForm.start).toISOString(), endDate: new Date(blockForm.end).toISOString(), reason: blockForm.reason })
      qc.invalidateQueries({ queryKey: ['availability', id] })
      toast.success('Availability blocked')
      setBlockForm({ start: '', end: '', reason: 'owner_blocked' })
      setOpen(null)
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusy(false) }
  }

  async function removeBlock(blockId: string) {
    try {
      await apiFns.unblockAvailability(id!, blockId)
      qc.invalidateQueries({ queryKey: ['availability', id] })
      toast.success('Block removed')
    } catch (err) { toast.error((err as ApiError).message) }
  }

  async function removeWindow(windowId: string) {
    try {
      await apiFns.deleteMaintenanceWindow(id!, windowId)
      qc.invalidateQueries({ queryKey: ['maintenance-windows', id] })
      qc.invalidateQueries({ queryKey: ['availability', id] })
      toast.success('Window removed')
    } catch (err) { toast.error((err as ApiError).message) }
  }

  async function removeLog(logId: string) {
    try {
      await apiFns.deleteMaintenance(id!, logId)
      qc.invalidateQueries({ queryKey: ['maintenance', id] })
      toast.success('Log removed')
    } catch (err) { toast.error((err as ApiError).message) }
  }

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-8"><CardGridSkeleton count={1} /></div>
  if (!item) return <div className="mx-auto max-w-3xl px-4 py-8"><ErrorState message="Equipment not found" /></div>

  const maintLogs = (logs || []) as { id: string; title: string; description: string | null; cost: number; performedAt: string }[]
  const maintWindows = (windows || []) as { id: string; startDate: string; endDate: string; notes: string | null }[]
  const availBlocks = (blocks || []) as { id: string; startDate: string; endDate: string; reason: string }[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('owner-listings')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to listings
      </button>
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Dashboard', view: 'owner-dashboard' },
          { label: 'My Listings', view: 'owner-listings' },
          { label: 'Maintenance' },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Maintenance & availability</h1>
        <p className="text-sm text-muted-foreground">{item.title}</p>
      </div>

      {/* Availability blocks */}
      <section className="mb-6 rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-5 w-5 text-amber-500" /> Availability blocks</h2>
          <Button size="sm" variant="outline" onClick={() => setOpen('block')}><Plus className="mr-1 h-4 w-4" /> Block dates</Button>
        </div>
        {availBlocks.length === 0 ? (
          <EmptyState title="No blocked dates" description="Block dates when your equipment is unavailable (owner-blocked or booked)." icon={Ban} />
        ) : (
          <div className="space-y-2">
            {availBlocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  <span className="capitalize">{b.reason.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{formatDate(b.startDate)} → {formatDate(b.endDate)}</span>
                  {b.reason !== 'maintenance' && <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeBlock(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Maintenance windows */}
      <section className="mb-6 rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><Clock className="h-5 w-5 text-primary" /> Scheduled maintenance</h2>
          <Button size="sm" variant="outline" onClick={() => setOpen('window')}><Plus className="mr-1 h-4 w-4" /> Schedule</Button>
        </div>
        {maintWindows.length === 0 ? (
          <EmptyState title="No scheduled maintenance" description="Schedule upcoming maintenance windows — these auto-block the dates." icon={Clock} />
        ) : (
          <div className="space-y-2">
            {maintWindows.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                <div>
                  <span className="font-medium">{formatDate(w.startDate)} → {formatDate(w.endDate)}</span>
                  {w.notes && <p className="text-xs text-muted-foreground">{w.notes}</p>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeWindow(w.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Maintenance logs */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><Wrench className="h-5 w-5 text-primary" /> Maintenance logs</h2>
          <Button size="sm" variant="outline" onClick={() => setOpen('log')}><Plus className="mr-1 h-4 w-4" /> Add log</Button>
        </div>
        {maintLogs.length === 0 ? (
          <EmptyState title="No maintenance logged" description="Keep a service history to build renter trust." icon={Wrench} />
        ) : (
          <div className="space-y-2">
            {maintLogs.map((l) => (
              <div key={l.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <div className="flex items-start justify-between">
                  <p className="font-medium">{l.title}</p>
                  <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeLog(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                {l.description && <p className="mt-0.5 text-sm text-muted-foreground">{l.description}</p>}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(l.performedAt)}</span>
                  {l.cost > 0 && <span>Cost {formatCurrency(l.cost)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dialogs */}
      <Dialog open={open === 'log'} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add maintenance log</DialogTitle><DialogDescription>Record a completed service or repair.</DialogDescription></DialogHeader>
          <form onSubmit={addLog} className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input required value={logForm.title} onChange={(e) => setLogForm({ ...logForm, title: e.target.value })} placeholder="Quarterly service" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cost (₹)</Label><Input type="number" min={0} value={logForm.cost} onChange={(e) => setLogForm({ ...logForm, cost: Number(e.target.value) })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save log'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'window'} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule maintenance window</DialogTitle><DialogDescription>Blocks the dates automatically for availability.</DialogDescription></DialogHeader>
          <form onSubmit={addWindow} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={winForm.start} onChange={(e) => setWinForm({ ...winForm, start: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>End</Label><Input type="date" value={winForm.end} onChange={(e) => setWinForm({ ...winForm, end: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={winForm.notes} onChange={(e) => setWinForm({ ...winForm, notes: e.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Schedule'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'block'} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Block availability</DialogTitle><DialogDescription>Mark dates when this equipment is unavailable.</DialogDescription></DialogHeader>
          <form onSubmit={addBlock} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={blockForm.start} onChange={(e) => setBlockForm({ ...blockForm, start: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>End</Label><Input type="date" value={blockForm.end} onChange={(e) => setBlockForm({ ...blockForm, end: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Block dates'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
