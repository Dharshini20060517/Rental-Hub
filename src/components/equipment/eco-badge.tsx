'use client'

import { Leaf, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Carbon and savings badge for equipment cards / detail */
export function EcoBadge({ baseDailyPrice, categoryAverage, className }: { baseDailyPrice: number; categoryAverage?: number; className?: string }) {
  const isCheaper = categoryAverage !== undefined && baseDailyPrice < categoryAverage
  const savingsPct = isCheaper ? Math.round(((categoryAverage - baseDailyPrice) / categoryAverage) * 100) : 0
  const isEcoCategory = true // all rental is "eco" (reuse vs buy)

  if (!isCheaper && !isEcoCategory) return null

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
        <Leaf className="h-2.5 w-2.5" /> Eco-rental
      </span>
      {isCheaper && savingsPct >= 10 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">
          <TrendingDown className="h-2.5 w-2.5" /> {savingsPct}% cheaper
        </span>
      )}
    </div>
  )
}
