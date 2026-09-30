'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'

type Cat = { id: string; name: string; slug: string; description: string | null; createdAt: string; _count?: { equipment: number } }

export function AdminCategoriesView() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cat | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const [busy, setBusy] = useState(false)

  const { data, isLoading } = useQuery<{ rows: Cat[]; counts: Record<string, number> }>({
    queryKey: ['categories', 'admin'],
    queryFn: async () => {
      const rows = (await apiFns.listCategories()) as Cat[]
      const { api } = await import('@/lib/api-client')
      const eqRes = await api.get('/equipment', { params: { limit: 1, status: 'active_paused' } })
      void eqRes
      // counts via separate small query per category is heavy; approximate by reading all equipment once
      const all = await api.get('/equipment', { params: { limit: 48 } })
      const counts: Record<string, number> = {}
      ;(all.data.data || []).forEach((e: { categoryId: string }) => { counts[e.categoryId] = (counts[e.categoryId] || 0) + 1 })
      return { rows, counts }
    },
  })

  function openNew() { setEditing(null); setForm({ name: '', slug: '', description: '' }); setOpen(true) }
  function openEdit(c: Cat) { setEditing(c); setForm({ name: c.name, slug: c.slug, description: c.description || '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (editing) await apiFns.updateCategory(editing.id, form)
      else await apiFns.createCategory(form)
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(editing ? 'Category updated' : 'Category created')
      setOpen(false)
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusy(false) }
  }

  async function remove(c: Cat) {
    if (!confirm(`Delete category "${c.name}"? This soft-deletes it.`)) return
    try {
      await apiFns.deleteCategory(c.id)
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted')
    } catch (err) { toast.error((err as ApiError).message) }
  }

  const rows = data?.rows || []

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><LayoutGrid className="h-6 w-6 text-primary" /> Categories</h1>
          <p className="text-sm text-muted-foreground">{rows.length} categories</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> New category</Button>
      </div>

      {isLoading ? <CardGridSkeleton count={3} /> : rows.length === 0 ? <EmptyState title="No categories" icon={LayoutGrid} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">/{c.slug}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {c.description && <p className="rh-line-clamp-2 mt-2 text-sm text-muted-foreground">{c.description}</p>}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{data?.counts[c.id] || 0} listings</span>
                <span>since {formatDate(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
            <DialogDescription>Categories group equipment for browsing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') })} placeholder="Power Tools" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="power-tools" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
