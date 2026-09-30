'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { TrendingDown, TrendingUp, Minus, BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

type Insight = {
  avgPrice: number
  minPrice: number
  maxPrice: number
  avgDeposit: number
  priceDiff: number
  depositDiff: number
  percentile: number
  siblingCount: number
  verdict: 'great_deal' | 'fair_price' | 'premium' | 'no_comparison'
  verdictLabel: string
  verdictColor: string
}

export function PriceInsight({ equipmentId, currentPrice }: { equipmentId: string; currentPrice: number }) {
  const { data } = useQuery<Insight>({
    queryKey: ['price-insight', equipmentId],
    queryFn: () => apiFns.getPriceInsight(equipmentId),
    enabled: !!equipmentId,
  })

  if (!data) return null

  const DiffIcon = data.priceDiff < -5 ? TrendingDown : data.priceDiff > 5 ? TrendingUp : Minus
  const diffColor = data.priceDiff < -5 ? 'text-emerald-600' : data.priceDiff > 5 ? 'text-amber-600' : 'text-muted-foreground'

  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Price insight</p>
        <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-xs font-bold', data.verdictColor, 'border-current/20')}>
          {data.verdictLabel}
        </span>
      </div>

      {data.siblingCount > 0 ? (
        <div className="space-y-2.5">
          {/* Price comparison */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">vs category average</span>
            <span className={cn('flex items-center gap-1 font-medium', diffColor)}>
              <DiffIcon className="h-3.5 w-3.5" />
              {data.priceDiff > 0 ? '+' : ''}{data.priceDiff}%
            </span>
          </div>

          {/* Percentile bar */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Price percentile</span>
              <span>{data.percentile}% cheaper than peers</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              {/* Range bar from min to max */}
              <div className="absolute inset-0 flex">
                <div className="bg-emerald-500/20" style={{ width: '33%' }} />
                <div className="bg-sky-500/20" style={{ width: '34%' }} />
                <div className="bg-amber-500/20" style={{ width: '33%' }} />
              </div>
              {/* Marker for this listing */}
              <div
                className="absolute top-0 h-full w-1 rounded-full bg-primary"
                style={{ left: `${100 - data.percentile}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
              <span>{formatCurrency(data.minPrice)}</span>
              <span>avg {formatCurrency(data.avgPrice)}</span>
              <span>{formatCurrency(data.maxPrice)}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 border-t pt-2.5 text-center text-xs">
            <div>
              <p className="font-bold text-foreground">{formatCurrency(data.avgPrice)}</p>
              <p className="text-muted-foreground/70">Avg price</p>
            </div>
            <div>
              <p className="font-bold text-foreground">{formatCurrency(data.avgDeposit)}</p>
              <p className="text-muted-foreground/70">Avg deposit</p>
            </div>
            <div>
              <p className="font-bold text-foreground">{data.siblingCount}</p>
              <p className="text-muted-foreground/70">Similar items</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This is the only listing in its category — no comparison data available yet.
        </p>
      )}
    </div>
  )
}
