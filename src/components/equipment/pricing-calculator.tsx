'use client'

import { useState, useMemo } from 'react'
import { Calculator, Calendar, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/format'
import { calculatePrice, type PricingRule, type PriceBreakdown } from '@/lib/pricing'
import { cn } from '@/lib/utils'

export function PricingCalculator({
  baseDailyPrice,
  baseDeposit,
  pricingRules,
}: {
  baseDailyPrice: number
  baseDeposit: number
  pricingRules: PricingRule[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDays(today, 3))

  const breakdown = useMemo<PriceBreakdown | null>(() => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end <= start) return null
    return calculatePrice(baseDailyPrice, baseDeposit, start, end, pricingRules)
  }, [startDate, endDate, baseDailyPrice, baseDeposit, pricingRules])

  function setQuickRange(days: number) {
    setStartDate(today)
    setEndDate(addDays(today, days))
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Price calculator</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="pc-start" className="text-xs">Start date</Label>
          <Input id="pc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pc-end" className="text-xs">End date</Label>
          <Input id="pc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        {[1, 3, 7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setQuickRange(d)}
            className="rounded-md border bg-background px-2 py-1 text-xs transition hover:border-primary/40 hover:bg-primary/5"
          >
            {d === 1 ? '1 day' : d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 30 ? '1 month' : `${d} days`}
          </button>
        ))}
      </div>

      {breakdown ? (
        <div className="mt-4 space-y-2 border-t pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{formatCurrency(baseDailyPrice)} × {breakdown.days} days</span>
            <span className="font-medium">{formatCurrency(breakdown.baseTotal)}</span>
          </div>

          {breakdown.adjustments.map((adj, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {adj.type === 'discount' ? <TrendingDown className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingUp className="h-3.5 w-3.5 text-amber-500" />}
                {adj.label}
              </span>
              <span className={cn('font-medium', adj.type === 'discount' ? 'text-emerald-600' : 'text-amber-600')}>
                {adj.type === 'discount' ? '−' : '+'}{formatCurrency(adj.amount)}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Security deposit (refundable)</span>
            <span className="font-medium">{formatCurrency(breakdown.deposit)}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-primary">Total rental cost</p>
              <p className="text-[11px] text-muted-foreground">{formatCurrency(breakdown.perDay)}/day effective</p>
            </div>
            <p className="text-xl font-bold text-primary">{formatCurrency(breakdown.total)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Select a valid date range to estimate the cost.</p>
      )}
    </div>
  )
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
