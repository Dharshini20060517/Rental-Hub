'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { RatingStars } from '@/components/shared/rating-stars'
import { Button } from '@/components/ui/button'
import { Check, X, GitCompareArrows, ChevronLeft } from 'lucide-react'
import { formatCurrency, conditionLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export function CompareView() {
  const idsParam = useRouterStore((s) => s.params.ids) || ''
  const ids = idsParam.split(',').filter(Boolean)
  const navigate = useRouterStore((s) => s.navigate)

  const { data, isLoading } = useQuery({
    queryKey: ['compare', ids],
    queryFn: () => (ids.length >= 2 ? apiFns.compareEquipment(ids) : Promise.resolve([])),
    enabled: ids.length >= 2,
  })

  const items = (data || []) as {
    id: string; title: string; baseDailyPrice: number; baseDeposit: number; baseHourlyPrice: number | null;
    condition: string; city: string | null; category: { name: string }; owner: { name: string | null; businessName: string | null; isVerified: boolean };
    rating: number; reviewCount: number; specs: { key: string; value: string }[]; images: { url: string; isPrimary: boolean }[]; status: string;
  }[]

  if (ids.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <EmptyState
          title="Select items to compare"
          description="Add 2–3 items using the compare button on any equipment card."
          icon={GitCompareArrows}
          action={<Button onClick={() => navigate('search')}>Browse equipment</Button>}
        />
      </div>
    )
  }

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><CardGridSkeleton count={1} /></div>

  // Build spec union across items
  const specKeys: string[] = []
  items.forEach((it) => it.specs.forEach((s) => { if (!specKeys.includes(s.key)) specKeys.push(s.key) }))

  // Find best value (lowest daily price)
  const cheapestId = items.length > 0 ? items.reduce((min, it) => (it.baseDailyPrice < min.baseDailyPrice ? it : min), items[0]).id : null
  // Find highest rated
  const topRatedId = items.length > 0 ? items.reduce((max, it) => (it.rating > max.rating ? it : max), items[0]).id : null
  // Find lowest deposit
  const lowestDepositId = items.length > 0 ? items.reduce((min, it) => (it.baseDeposit < min.baseDeposit ? it : min), items[0]).id : null

  const rows: { label: string; get: (it: typeof items[number]) => React.ReactNode }[] = [
    { label: 'Daily price', get: (it) => (
      <span className="flex items-center gap-1.5">
        <span className="font-bold text-primary">{formatCurrency(it.baseDailyPrice)}</span>
        {it.id === cheapestId && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">BEST VALUE</span>}
      </span>
    ) },
    { label: 'Hourly price', get: (it) => (it.baseHourlyPrice != null ? formatCurrency(it.baseHourlyPrice) : '—') },
    { label: 'Security deposit', get: (it) => (
      <span className="flex items-center gap-1.5">
        <span>{formatCurrency(it.baseDeposit)}</span>
        {it.id === lowestDepositId && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">LOWEST</span>}
      </span>
    ) },
    { label: 'Condition', get: (it) => conditionLabel(it.condition) },
    { label: 'Category', get: (it) => it.category.name },
    { label: 'Location', get: (it) => it.city || '—' },
    { label: 'Owner', get: (it) => <span>{it.owner.businessName || it.owner.name}{it.owner.isVerified && <Check className="ml-1 inline h-3 w-3 text-primary" />}</span> },
    { label: 'Rating', get: (it) => (
      <span className="flex items-center gap-1.5">
        <RatingStars rating={it.rating} size={12} count={it.reviewCount} />
        {it.id === topRatedId && it.rating > 0 && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">TOP RATED</span>}
      </span>
    ) },
    { label: 'Status', get: (it) => it.status },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('search')} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to browse
      </button>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Compare equipment</h1>
      <p className="mb-6 text-sm text-muted-foreground">Side-by-side comparison of {items.length} items.</p>

      <div className="overflow-x-auto rh-scroll rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 w-40 bg-muted/40 px-4 py-3 text-left font-medium text-muted-foreground">Attribute</th>
              {items.map((it) => (
                <th key={it.id} className="min-w-[220px] px-4 py-3 text-left align-top">
                  <button onClick={() => navigate('equipment', { id: it.id })} className="group block w-full text-left">
                    <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                      {it.images[0] && (
                         
                        <img src={it.images[0].url} alt={it.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                      )}
                    </div>
                    <p className="line-clamp-2 font-semibold leading-tight group-hover:text-primary">{it.title}</p>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label} className={cn('border-b', ri % 2 ? 'bg-muted/20' : '')}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-muted-foreground">{r.label}</td>
                {items.map((it) => (
                  <td key={it.id} className="px-4 py-3">{r.get(it)}</td>
                ))}
              </tr>
            ))}
            {specKeys.map((key, si) => (
              <tr key={key} className={cn('border-b', si % 2 ? 'bg-muted/20' : '')}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-muted-foreground">{key}</td>
                {items.map((it) => {
                  const spec = it.specs.find((s) => s.key === key)
                  return <td key={it.id} className="px-4 py-3">{spec ? spec.value : <X className="h-3.5 w-3.5 text-muted-foreground/40" />}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
