'use client'

import { GitCompareArrows, X } from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { Button } from '@/components/ui/button'

export function CompareBar() {
  const compareIds = useRouterStore((s) => s.compareIds)
  const toggleCompare = useRouterStore((s) => s.toggleCompare)
  const navigate = useRouterStore((s) => s.navigate)

  if (compareIds.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
        <GitCompareArrows className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">{compareIds.length} selected</span>
        <div className="hidden max-w-[220px] gap-1 sm:flex">
          {compareIds.slice(0, 3).map((id) => (
            <button key={id} onClick={() => toggleCompare(id)} className="group flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              <span className="max-w-[80px] truncate">item</span>
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
        <Button
          size="sm"
          disabled={compareIds.length < 2}
          onClick={() => navigate('compare', { ids: compareIds.join(',') })}
          className="h-7 rounded-full px-3"
        >
          Compare
        </Button>
        <button onClick={() => useRouterStore.setState({ compareIds: [] })} className="text-muted-foreground hover:text-foreground" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
