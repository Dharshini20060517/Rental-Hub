'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RatingStars({ rating, size = 14, showValue = true, count }: { rating: number; size?: number; showValue?: boolean; count?: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i < full
          const isHalf = i === full && half
          return (
            <Star
              key={i}
              size={size}
              className={cn(
                'shrink-0',
                filled || isHalf ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/40',
              )}
            />
          )
        })}
      </div>
      {showValue && (
        <span className="text-xs font-medium text-muted-foreground">
          {rating > 0 ? rating.toFixed(1) : 'New'}
          {count !== undefined && count > 0 && ` (${count})`}
        </span>
      )}
    </div>
  )
}
