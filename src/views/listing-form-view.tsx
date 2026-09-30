'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CardGridSkeleton } from '@/components/shared/states'
import { Plus, Trash2, ImagePlus, Star, GripVertical, Save, ChevronLeft, X } from 'lucide-react'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

type Rule = { type: 'weekend_surcharge' | 'long_discount' | 'seasonal'; value: number; unit: 'percent' | 'amount'; minDays?: number; label?: string; start?: string; end?: string }
type Spec = { key: string; value: string }

export function ListingFormView() {
  const id = useRouterStore((s) => s.params.id)
  const navigate = useRouterStore((s) => s.navigate)
  const qc = useQueryClient()
  const isEdit = !!id
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => apiFns.listCategories() })
  const { data: existing, isLoading } = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => apiFns.getEquipment(id!),
    enabled: isEdit,
  })

  const [form, setForm] = useState({
    title: '', description: '', categoryId: '', status: 'draft' as 'draft' | 'active' | 'paused',
    condition: 'good' as 'new' | 'like_new' | 'good' | 'fair' | 'poor',
    baseDailyPrice: 500, baseHourlyPrice: 0, baseDeposit: 1000, replacementValue: 0,
    city: '', address: '', lat: '', lng: '', bufferHours: 0, purchaseDate: '', conditionNotes: '',
  })
  const [rules, setRules] = useState<Rule[]>([])
  const [specs, setSpecs] = useState<Spec[]>([])
  const [images, setImages] = useState<{ id?: string; url: string; isPrimary?: boolean; isNew?: boolean; file?: File }[]>([])

  // Sync from existing on edit
  const [synced, setSynced] = useState(false)
  if (isEdit && existing && !synced) {
    setForm({
      title: existing.title, description: existing.description, categoryId: existing.categoryId, status: existing.status as never,
      condition: existing.condition as never, baseDailyPrice: existing.baseDailyPrice, baseHourlyPrice: existing.baseHourlyPrice || 0,
      baseDeposit: existing.baseDeposit, replacementValue: existing.replacementValue || 0, city: existing.city || '', address: existing.address || '',
      lat: existing.lat != null ? String(existing.lat) : '', lng: existing.lng != null ? String(existing.lng) : '',
      bufferHours: existing.bufferHours, purchaseDate: existing.purchaseDate ? existing.purchaseDate.slice(0, 10) : '',
      conditionNotes: existing.conditionNotes || '',
    })
    setRules(((existing.pricingRules as Rule[]) || []).map((r) => ({ ...r })))
    setSpecs((existing.specs || []).map((s) => ({ key: s.key, value: s.value })))
    setImages((existing.images || []).map((i) => ({ id: i.id, url: i.url, isPrimary: i.isPrimary })))
    setSynced(true)
  }

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }

  function addRule() { setRules((r) => [...r, { type: 'weekend_surcharge', value: 10, unit: 'percent' }]) }
  function updateRule(i: number, patch: Partial<Rule>) { setRules((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x))) }
  function removeRule(i: number) { setRules((r) => r.filter((_, idx) => idx !== i)) }

  function addSpec() { setSpecs((s) => [...s, { key: '', value: '' }]) }
  function updateSpec(i: number, patch: Partial<Spec>) { setSpecs((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x))) }
  function removeSpec(i: number) { setSpecs((s) => s.filter((_, idx) => idx !== i)) }

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newImgs = files.map((file) => ({ url: URL.createObjectURL(file), isNew: true, file, isPrimary: images.length === 0 }))
    setImages((im) => [...im, ...newImgs])
  }
  function setPrimary(idx: number) { setImages((im) => im.map((x, i) => ({ ...x, isPrimary: i === idx }))) }
  function removeImage(idx: number) { setImages((im) => im.filter((_, i) => i !== idx)); if (images[idx]?.isPrimary && images.length > 1) setImages((im) => im.map((x, i) => ({ ...x, isPrimary: i === 0 }))) }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || form.title.length < 3) return toast.error('Title must be at least 3 characters')
    if (!form.description || form.description.length < 10) return toast.error('Description too short')
    if (!form.categoryId) return toast.error('Please choose a category')
    if (form.baseDailyPrice < 0) return toast.error('Daily price must be 0 or more')

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: form.title, description: form.description, categoryId: form.categoryId, status: form.status, condition: form.condition,
        baseDailyPrice: Number(form.baseDailyPrice), baseHourlyPrice: Number(form.baseHourlyPrice) || null, baseDeposit: Number(form.baseDeposit),
        replacementValue: Number(form.replacementValue) || null, city: form.city || null, address: form.address || null,
        lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null, bufferHours: Number(form.bufferHours),
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null, conditionNotes: form.conditionNotes || null,
        pricingRules: rules, specs: specs.filter((s) => s.key && s.value),
      }

      let equipmentId = id
      if (isEdit) {
        await apiFns.updateEquipment(id!, payload)
        toast.success('Listing updated')
      } else {
        const { api } = await import('@/lib/api-client')
        const res = await api.post('/equipment', payload)
        equipmentId = res.data.data.id
        toast.success('Listing created')
      }

      // Upload new images
      const newFiles = images.filter((i) => i.isNew && i.file).map((i) => i.file!) as File[]
      if (newFiles.length && equipmentId) {
        setUploading(true)
        try {
          await apiFns.uploadImages(equipmentId, newFiles)
          toast.success(`${newFiles.length} image(s) uploaded`)
        } catch (err) {
          toast.error('Image upload failed: ' + (err as ApiError).message)
        } finally {
          setUploading(false)
        }
      }

      // Delete removed existing images
      const removed = (existing?.images || []).filter((old) => !images.some((i) => i.id === old.id))
      for (const img of removed) {
        try { await apiFns.deleteImage(equipmentId!, img.id) } catch { /* ignore */ }
      }

      qc.invalidateQueries({ queryKey: ['my-equipment'] })
      qc.invalidateQueries({ queryKey: ['equipment', equipmentId] })
      navigate('owner-listings')
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && isLoading) return <div className="mx-auto max-w-3xl px-4 py-8"><CardGridSkeleton count={1} /></div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('owner-listings')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to listings
      </button>
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'Dashboard', view: 'owner-dashboard' },
          { label: 'My Listings', view: 'owner-listings' },
          { label: isEdit ? 'Edit listing' : 'New listing' },
        ]}
      />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{isEdit ? 'Edit listing' : 'Create a listing'}</h1>
      <p className="mb-6 text-sm text-muted-foreground">Provide details, pricing, and photos. Drafts are hidden from search.</p>

      <form onSubmit={onSubmit} className="space-y-8">
        {/* Basics */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basics</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Bosch GSB 550W Impact Drill" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description *</Label>
              <Textarea id="desc" rows={4} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Condition, included accessories, rental terms…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.categoryId} onValueChange={(v) => update('categoryId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{(categories || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <Select value={form.condition} onValueChange={(v) => update('condition', v as never)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['new', 'like_new', 'good', 'fair', 'poor'].map((c) => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => update('status', v as never)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (hidden)</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pricing</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Daily price *</Label>
              <Input type="number" min={0} value={form.baseDailyPrice} onChange={(e) => update('baseDailyPrice', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Hourly (optional)</Label>
              <Input type="number" min={0} value={form.baseHourlyPrice} onChange={(e) => update('baseHourlyPrice', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Deposit</Label>
              <Input type="number" min={0} value={form.baseDeposit} onChange={(e) => update('baseDeposit', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Replacement value</Label>
              <Input type="number" min={0} value={form.replacementValue} onChange={(e) => update('replacementValue', Number(e.target.value))} />
            </div>
          </div>

          {/* Dynamic pricing rules */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>Dynamic pricing rules</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRule}><Plus className="mr-1 h-3.5 w-3.5" /> Add rule</Button>
            </div>
            <div className="space-y-2">
              {rules.length === 0 && <p className="text-xs text-muted-foreground">No rules. Add a weekend surcharge, long-rental discount, or seasonal override.</p>}
              {rules.map((r, i) => (
                <div key={i} className="grid items-end gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-6">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[11px]">Type</Label>
                    <Select value={r.type} onValueChange={(v) => updateRule(i, { type: v as Rule['type'] })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekend_surcharge">Weekend surcharge</SelectItem>
                        <SelectItem value="long_discount">Long-rental discount</SelectItem>
                        <SelectItem value="seasonal">Seasonal override</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Value</Label>
                    <Input className="h-8" type="number" value={r.value} onChange={(e) => updateRule(i, { value: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Unit</Label>
                    <Select value={r.unit} onValueChange={(v) => updateRule(i, { unit: v as Rule['unit'] })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">₹/day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {r.type === 'long_discount' ? (
                    <div className="space-y-1">
                      <Label className="text-[11px]">Min days</Label>
                      <Input className="h-8" type="number" min={1} value={r.minDays || 1} onChange={(e) => updateRule(i, { minDays: Number(e.target.value) })} />
                    </div>
                  ) : (
                    <div className="sm:col-span-1" />
                  )}
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeRule(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Location & ops */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location & operations</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Mumbai" /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Area / landmark" /></div>
            <div className="space-y-1.5"><Label>Latitude</Label><Input type="number" step="any" value={form.lat} onChange={(e) => update('lat', e.target.value)} placeholder="19.076" /></div>
            <div className="space-y-1.5"><Label>Longitude</Label><Input type="number" step="any" value={form.lng} onChange={(e) => update('lng', e.target.value)} placeholder="72.8777" /></div>
            <div className="space-y-1.5"><Label>Buffer hours</Label><Input type="number" min={0} max={72} value={form.bufferHours} onChange={(e) => update('bufferHours', Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label>Purchase date</Label><Input type="date" value={form.purchaseDate} onChange={(e) => update('purchaseDate', e.target.value)} /></div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label>Condition notes</Label>
            <Textarea rows={2} value={form.conditionNotes} onChange={(e) => update('conditionNotes', e.target.value)} placeholder="Service history, known wear…" />
          </div>
        </section>

        {/* Images */}
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Images</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 h-3.5 w-3.5" /> Add images</Button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
          </div>
          {images.length === 0 ? (
            <p className="text-xs text-muted-foreground">Upload up to 8 images. The first image is shown as the cover.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img, i) => (
                <div key={i} className={cn('group relative aspect-[4/3] overflow-hidden rounded-lg border-2', img.isPrimary ? 'border-primary' : 'border-transparent')}>
                  { }
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition group-hover:opacity-100">
                    {!img.isPrimary && <button type="button" onClick={() => setPrimary(i)} className="grid h-7 w-7 place-items-center rounded-full bg-background/90" title="Set as cover"><Star className="h-3.5 w-3.5" /></button>}
                    <button type="button" onClick={() => removeImage(i)} className="grid h-7 w-7 place-items-center rounded-full bg-destructive text-destructive-foreground" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {img.isPrimary && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Cover</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Specs */}
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Specifications</h2>
            <Button type="button" variant="outline" size="sm" onClick={addSpec}><Plus className="mr-1 h-3.5 w-3.5" /> Add spec</Button>
          </div>
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input placeholder="Key (e.g. Power)" value={s.key} onChange={(e) => updateSpec(i, { key: e.target.value })} className="h-9" />
                <Input placeholder="Value (e.g. 550W)" value={s.value} onChange={(e) => updateSpec(i, { value: e.target.value })} className="h-9" />
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeSpec(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {specs.length === 0 && <p className="text-xs text-muted-foreground">Add key/value specs like Power, Weight, Brand, etc.</p>}
          </div>
        </section>

        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <Button type="button" variant="outline" onClick={() => navigate('owner-listings')}>Cancel</Button>
          <Button type="submit" disabled={saving || uploading}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Saving…' : uploading ? 'Uploading…' : isEdit ? 'Save changes' : 'Create listing'}
          </Button>
        </div>
      </form>
    </div>
  )
}
