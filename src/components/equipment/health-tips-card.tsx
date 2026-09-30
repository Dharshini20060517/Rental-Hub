'use client'

import { useState } from 'react'
import { Lightbulb, ChevronDown, ChevronUp, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type HealthCheck = {
  label: string
  passed: boolean
  points: number
  maxPoints: number
  hint?: string
}

type Listing = {
  id: string
  title: string
  healthScore: number
  healthGrade: string
  healthChecks?: HealthCheck[]
}

export function HealthTipsCard({ listings }: { listings: Listing[] }) {
  const navigate = useRouterStore((s) => s.navigate)
  const [expanded, setExpanded] = useState(false)

  // Aggregate failed checks across all listings
  const failedMap = new Map<string, { hint?: string; count: number; listings: string[]; maxPoints: number }>()

  for (const listing of listings) {
    if (!listing.healthChecks) continue
    for (const check of listing.healthChecks) {
      if (!check.passed) {
        const existing = failedMap.get(check.label)
        if (existing) {
          existing.count++
          existing.listings.push(listing.title)
        } else {
          failedMap.set(check.label, {
            hint: check.hint,
            count: 1,
            listings: [listing.title],
            maxPoints: check.maxPoints,
          })
        }
      }
    }
  }

  const failedTips = Array.from(failedMap.entries())
    .map(([label, data]) => ({ label, ...data }))
    .sort((a, b) => b.count - a.count || b.maxPoints - a.maxPoints)

  if (failedTips.length === 0) {
    return (
      <div className="rounded-xl border bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h3 className="text-sm font-semibold">All listings are fully optimized!</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Every listing passes all health checks. Great work!</p>
      </div>
    )
  }

  const avgScore = listings.length > 0 ? Math.round(listings.reduce((s, l) => s + (l.healthScore || 0), 0) / listings.length) : 0
  const potentialGain = failedTips.reduce((sum, t) => sum + t.maxPoints, 0)

  const visibleTips = expanded ? failedTips : failedTips.slice(0, 3)

  return (
    <div className="rounded-xl border bg-gradient-to-br from-amber-500/5 to-transparent p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Improve your listings
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Avg health score: <span className="font-bold text-foreground">{avgScore}/100</span> · potential gain: <span className="font-bold text-emerald-600">+{potentialGain} pts</span>
          </p>
        </div>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600">
          {failedTips.length} {failedTips.length === 1 ? 'tip' : 'tips'}
        </span>
      </div>

      <div className="space-y-2">
        {visibleTips.map((tip) => (
          <div key={tip.label} className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{tip.label}</p>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {tip.count} {tip.count === 1 ? 'listing' : 'listings'}
                </span>
              </div>
              {tip.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{tip.hint}</p>}
              {expanded && tip.listings.length > 0 && (
                <p className="mt-1 truncate text-[10px] text-muted-foreground/70">
                  {tip.listings.slice(0, 3).join(', ')}{tip.listings.length > 3 && ` +${tip.listings.length - 3} more`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {failedTips.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/50"
        >
          {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5" /> Show {failedTips.length - 3} more</>}
        </button>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => navigate('owner-listings')}
      >
        Manage listings <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
