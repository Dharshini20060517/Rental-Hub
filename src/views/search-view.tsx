'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState, ErrorState } from '@/components/shared/feedback'
import { Pagination } from '@/components/shared/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { SlidersHorizontal, Search, X, MapPin, LayoutGrid, List } from 'lucide-react'
import { EquipmentListCard } from '@/components/equipment/equipment-list-card'
import { formatCurrency } from '@/lib/format'

const PRICE_CAP = 8000

export function SearchView() {
  const params = useRouterStore((s) => s.params)
  const navigate = useRouterStore((s) => s.navigate)
  const replace = useRouterStore((s) => s.replace)

  const [filters, setFilters] = useState({
    q: params.q || '',
    category: params.category || '',
    minPrice: params.minPrice ? Number(params.minPrice) : 0,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : PRICE_CAP,
    minRating: params.minRating ? Number(params.minRating) : 0,
    city: params.city || '',
    sort: params.sort || 'createdAt',
    order: params.order || 'desc',
    page: params.page ? Number(params.page) : 1,
    limit: 12,
  })
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Sync from URL when navigating into search
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      q: params.q || '',
      category: params.category || '',
      minPrice: params.minPrice ? Number(params.minPrice) : 0,
      maxPrice: params.maxPrice ? Number(params.maxPrice) : PRICE_CAP,
      minRating: params.minRating ? Number(params.minRating) : 0,
      city: params.city || '',
      sort: params.sort || 'createdAt',
      order: params.order || 'desc',
      page: params.page ? Number(params.page) : 1,
    }))
     
  }, [JSON.stringify(params)])

  const { data, isLoading, isError, refetch } = useQuery<{ rows: EquipmentListItem[]; total: number; totalPages: number }>({
    queryKey: ['equipment', 'search', filters],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const sp: Record<string, string | number | undefined> = {
        page: filters.page,
        limit: filters.limit,
        sort: filters.sort,
        order: filters.order,
      }
      if (filters.q) sp.q = filters.q
      if (filters.category) sp.category = filters.category
      if (filters.minPrice > 0) sp.minPrice = filters.minPrice
      if (filters.maxPrice < PRICE_CAP) sp.maxPrice = filters.maxPrice
      if (filters.minRating > 0) sp.minRating = filters.minRating
      if (filters.city) sp.city = filters.city
      const res = await api.get('/equipment', { params: sp })
      return {
        rows: (res.data.data || []) as EquipmentListItem[],
        total: res.data.meta?.total ?? res.data.data?.length ?? 0,
        totalPages: res.data.meta?.totalPages ?? 0,
      }
    },
  })

  const rows = data?.rows || []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => apiFns.listCategories() })

  function update(partial: Partial<typeof filters>, replaceUrl = false) {
    const next = { ...filters, ...partial, page: partial.page ? partial.page : 1 }
    setFilters(next)
    const urlParams: Record<string, string> = {}
    if (next.q) urlParams.q = next.q
    if (next.category) urlParams.category = next.category
    if (next.minPrice > 0) urlParams.minPrice = String(next.minPrice)
    if (next.maxPrice < PRICE_CAP) urlParams.maxPrice = String(next.maxPrice)
    if (next.minRating > 0) urlParams.minRating = String(next.minRating)
    if (next.city) urlParams.city = next.city
    if (next.sort && next.sort !== 'createdAt') urlParams.sort = next.sort
    if (next.order && next.order !== 'desc') urlParams.order = next.order
    if (next.page > 1) urlParams.page = String(next.page)
    if (replaceUrl) replace('search', urlParams)
    else navigate('search', urlParams)
  }

  function reset() {
    setFilters({ q: '', category: '', minPrice: 0, maxPrice: PRICE_CAP, minRating: 0, city: '', sort: 'createdAt', order: 'desc', page: 1, limit: 12 })
    navigate('search')
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.category) n++
    if (filters.minPrice > 0) n++
    if (filters.maxPrice < PRICE_CAP) n++
    if (filters.minRating > 0) n++
    if (filters.city) n++
    if (filters.q) n++
    return n
  }, [filters])

  const FilterPanel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {activeFilterCount > 0 && (
          <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Reset ({activeFilterCount})
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Keyword</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.q} onChange={(e) => update({ q: e.target.value })} placeholder="Search…" className="h-9 pl-8" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Category</Label>
        <Select value={filters.category || 'all'} onValueChange={(v) => update({ category: v === 'all' ? '' : v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories || []).map((c) => (
              <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Daily price</Label>
          <span className="text-xs text-muted-foreground">
            {formatCurrency(filters.minPrice)} – {filters.maxPrice >= PRICE_CAP ? `${formatCurrency(PRICE_CAP)}+` : formatCurrency(filters.maxPrice)}
          </span>
        </div>
        <Slider
          min={0}
          max={PRICE_CAP}
          step={100}
          value={[filters.minPrice, filters.maxPrice]}
          onValueChange={(v) => update({ minPrice: v[0], maxPrice: v[1] })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Minimum rating</Label>
        <Select value={String(filters.minRating)} onValueChange={(v) => update({ minRating: Number(v) })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0, 3, 4, 4.5].map((r) => (
              <SelectItem key={r} value={String(r)}>{r === 0 ? 'Any rating' : `${r}+ stars`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">City</Label>
        <Input value={filters.city} onChange={(e) => update({ city: e.target.value })} placeholder="e.g. Mumbai" className="h-9" />
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Browse equipment</h1>
          <p className="text-sm text-muted-foreground">{total} listings available{activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`grid h-8 w-8 place-items-center rounded-md transition ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`grid h-8 w-8 place-items-center rounded-md transition ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Select value={filters.sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Newest</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="title">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => update({ order: filters.order === 'asc' ? 'desc' : 'asc' })}>
            {filters.order === 'asc' ? '↑ asc' : '↓ desc'}
          </Button>
        </div>
      </div>

      {/* Quick filter chips */}
      {activeFilterCount === 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Quick filters</p>
          <div className="flex flex-wrap gap-1.5">
            <QuickChip label="⚡ Power Tools" onClick={() => update({ category: 'power-tools' })} />
            <QuickChip label="🚜 Earthmoving" onClick={() => update({ category: 'earthmoving' })} />
            <QuickChip label="📷 Photography" onClick={() => update({ category: 'photography' })} />
            <QuickChip label="🎪 Party & Events" onClick={() => update({ category: 'party-events' })} />
            <QuickChip label="⭐ 4+ rating" onClick={() => update({ minRating: 4 })} />
            <QuickChip label="💸 Under ₹500/day" onClick={() => update({ maxPrice: 500 })} />
            <QuickChip label="🏆 Premium (₹2000+)" onClick={() => update({ minPrice: 2000 })} />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.q && (
            <FilterChip label={`"${filters.q}"` } onRemove={() => update({ q: '' })} />
          )}
          {filters.category && (
            <FilterChip label={`Category: ${filters.category}`} onRemove={() => update({ category: '' })} />
          )}
          {filters.minPrice > 0 && (
            <FilterChip label={`Min ₹${filters.minPrice}`} onRemove={() => update({ minPrice: 0 })} />
          )}
          {filters.maxPrice < PRICE_CAP && (
            <FilterChip label={`Max ₹${filters.maxPrice}`} onRemove={() => update({ maxPrice: PRICE_CAP })} />
          )}
          {filters.minRating > 0 && (
            <FilterChip label={`${filters.minRating}+ stars`} onRemove={() => update({ minRating: 0 })} />
          )}
          {filters.city && (
            <FilterChip label={`City: ${filters.city}`} onRemove={() => update({ city: '' })} />
          )}
          <button onClick={reset} className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10">
            <X className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop filters */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 rounded-xl border bg-card p-4">{FilterPanel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile filter trigger */}
          <div className="mb-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetTitle>Filters</SheetTitle>
                <div className="mt-4">{FilterPanel}</div>
              </SheetContent>
            </Sheet>
          </div>

          {isError ? (
            <ErrorState message="Failed to load listings" onRetry={() => refetch()} />
          ) : isLoading ? (
            <CardGridSkeleton count={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No equipment found"
              description="Try adjusting your filters or search query."
              icon={Search}
              action={<Button onClick={reset}>Reset filters</Button>}
            />
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((item) => (
                    <EquipmentCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3 rh-stagger">
                  {rows.map((item) => (
                    <EquipmentListCard key={item.id} item={item} />
                  ))}
                </div>
              )}
              <div className="mt-6">
                <Pagination page={filters.page} totalPages={totalPages} onChange={(p) => update({ page: p })} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {label}
      <button onClick={onRemove} className="grid h-3.5 w-3.5 place-items-center rounded-full transition hover:bg-foreground/20" aria-label="Remove filter">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      {label}
    </button>
  )
}
