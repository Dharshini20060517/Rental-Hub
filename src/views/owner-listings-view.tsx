'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns, type ApiError } from '@/lib/api-client'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState, StatusBadge } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Package, Wrench, CalendarClock, Pencil, Trash2, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { useState } from 'react'

export function OwnerListingsView() {
  const navigate = useRouterStore((s) => s.navigate)
  const qc = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<EquipmentListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading } = useQuery<{ rows: EquipmentListItem[]; total: number }>({
    queryKey: ['my-equipment'],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/equipment/my', { params: { limit: 48 } })
      return { rows: (res.data.data || []) as EquipmentListItem[], total: res.data.meta?.total ?? 0 }
    },
  })

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiFns.deleteEquipment(deleteTarget.id)
      qc.invalidateQueries({ queryKey: ['my-equipment'] })
      toast.success('Listing deleted')
      setDeleteTarget(null)
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setDeleting(false)
    }
  }

  const rows = data?.rows || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My listings</h1>
          <p className="text-sm text-muted-foreground">{rows.length} listings · manage availability, pricing & maintenance</p>
        </div>
        <Button onClick={() => navigate('listing-form')}><Plus className="mr-1.5 h-4 w-4" /> New listing</Button>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Create your first listing to start earning from your equipment."
          icon={Package}
          action={<Button onClick={() => navigate('listing-form')}><Plus className="mr-1.5 h-4 w-4" /> Create listing</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row">
              <button onClick={() => navigate('equipment', { id: item.id })} className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48">
                {item.images[0] ? (
                   
                  <img src={item.images[0].url} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground"><Package className="h-8 w-8" /></div>
                )}
              </button>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.category.name} · {item.city || 'No location'}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-bold text-primary">{formatCurrency(item.baseDailyPrice)}<span className="text-xs font-normal text-muted-foreground">/day</span></span>
                  <span className="text-muted-foreground">Deposit {formatCurrency(item.baseDeposit)}</span>
                  <span className="text-muted-foreground">Listed {formatDate(item.createdAt)}</span>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <Button size="sm" variant="outline" onClick={() => navigate('equipment', { id: item.id })}><Eye className="mr-1 h-3.5 w-3.5" /> View</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('listing-form', { id: item.id })}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('maintenance', { id: item.id })}><Wrench className="mr-1 h-3.5 w-3.5" /> Maintenance</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>This will permanently remove “{deleteTarget?.title}”. This action can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting…' : 'Delete listing'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
