'use client'

import { ChevronRight } from 'lucide-react'
import { useRouterStore, type ViewKey } from '@/store/router'
import { cn } from '@/lib/utils'

export type Crumb = {
  label: string
  view?: ViewKey
  params?: Record<string, string>
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const navigate = useRouterStore((s) => s.navigate)
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm text-muted-foreground', className)}>
      {items.map((c, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
            {c.view && !isLast ? (
              <button
                onClick={() => navigate(c.view!, c.params)}
                className="rounded transition hover:text-foreground hover:underline"
              >
                {c.label}
              </button>
            ) : (
              <span className={cn(isLast && 'font-medium text-foreground')}>{c.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
