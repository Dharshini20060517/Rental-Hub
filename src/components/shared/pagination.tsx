'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = pageRange(page, totalPages)
  return (
    <div className="flex items-center justify-center gap-1.5">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} className="h-8 px-2">
        <ChevronLeft className="h-4 w-4" /> Prev
      </Button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1.5 text-muted-foreground">…</span>
        ) : (
          <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => onChange(p as number)} className="h-8 w-8 p-0">
            {p}
          </Button>
        ),
      )}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="h-8 px-2">
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function pageRange(current: number, total: number): (number | '...')[] {
  const delta = 1
  const out: (number | '...')[] = []
  const left = Math.max(2, current - delta)
  const right = Math.min(total - 1, current + delta)
  out.push(1)
  if (left > 2) out.push('...')
  for (let i = left; i <= right; i++) out.push(i)
  if (right < total - 1) out.push('...')
  if (total > 1) out.push(total)
  return out
}
