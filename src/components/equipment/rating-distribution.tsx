'use client'

import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Distribution = { stars: number; count: number }

export function RatingDistribution({ equipmentId, avgRating, reviewCount }: { equipmentId: string; avgRating: number; reviewCount: number }) {
  const { data } = useQuery<{ distribution: Distribution[]; total: number; avg: number }>({
    queryKey: ['rating-distribution', equipmentId],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get(`/equipment/${equipmentId}/rating-distribution`)
      return res.data.data
    },
    enabled: !!equipmentId,
  })

  const distribution = data?.distribution || []
  const total = data?.total || reviewCount || 0

  if (total === 0) return null

  return (
    <div className="mb-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Overall score */}
        <div className="flex shrink-0 flex-col items-center justify-center border-b pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
          <p className="text-4xl font-bold text-amber-500">{(data?.avg ?? avgRating).toFixed(1)}</p>
          <div className="mt-1 flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={14}
                className={cn(
                  n <= Math.round(data?.avg ?? avgRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-muted text-muted-foreground/40',
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{total} review{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Bars */}
        <div className="flex-1 space-y-1.5">
          {distribution.map((d) => {
            const pct = total > 0 ? (d.count / total) * 100 : 0
            return (
              <div key={d.stars} className="flex items-center gap-2 text-xs">
                <span className="flex w-12 shrink-0 items-center gap-0.5 text-muted-foreground">
                  {d.stars} <Star size={10} className="fill-amber-400 text-amber-400" />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{d.count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
