// Pricing calculator — applies dynamic pricing rules to a base daily price.

export type PricingRule = {
  type: 'weekend_surcharge' | 'long_discount' | 'seasonal'
  value: number
  unit: 'percent' | 'amount'
  minDays?: number
  start?: string
  end?: string
  label?: string
}

export type PriceBreakdown = {
  days: number
  baseTotal: number
  adjustments: { label: string; amount: number; type: 'surcharge' | 'discount' }[]
  deposit: number
  total: number
  perDay: number
}

/**
 * Calculate the total rental cost for a date range.
 * Applies: weekend surcharge, long-duration discount, seasonal override.
 */
export function calculatePrice(
  baseDailyPrice: number,
  baseDeposit: number,
  startDate: Date,
  endDate: Date,
  rules: PricingRule[] = [],
): PriceBreakdown {
  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  const baseTotal = baseDailyPrice * days
  const adjustments: PriceBreakdown['adjustments'] = []

  // Count weekend days
  let weekendDays = 0
  const cursor = new Date(startDate)
  for (let i = 0; i < days; i++) {
    const dow = cursor.getDay()
    if (dow === 0 || dow === 6) weekendDays++
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const rule of rules) {
    switch (rule.type) {
      case 'weekend_surcharge': {
        if (weekendDays === 0) break
        const weekendBase = baseDailyPrice * weekendDays
        const amount = rule.unit === 'percent'
          ? (weekendBase * rule.value) / 100
          : rule.value * weekendDays
        adjustments.push({
          label: rule.label || `Weekend surcharge (${weekendDays} days)`,
          amount,
          type: 'surcharge',
        })
        break
      }
      case 'long_discount': {
        if (!rule.minDays || days < rule.minDays) break
        const amount = rule.unit === 'percent'
          ? (baseTotal * rule.value) / 100
          : rule.value * days
        adjustments.push({
          label: rule.label || `Long rental discount (${days} days)`,
          amount,
          type: 'discount',
        })
        break
      }
      case 'seasonal': {
        if (!rule.start || !rule.end) break
        const seasonStart = new Date(rule.start)
        const seasonEnd = new Date(rule.end)
        // Count days that fall within the seasonal window
        let seasonalDays = 0
        const c = new Date(startDate)
        for (let i = 0; i < days; i++) {
          if (c >= seasonStart && c <= seasonEnd) seasonalDays++
          c.setDate(c.getDate() + 1)
        }
        if (seasonalDays === 0) break
        const seasonalBase = baseDailyPrice * seasonalDays
        const amount = rule.unit === 'percent'
          ? (seasonalBase * rule.value) / 100
          : rule.value * seasonalDays
        adjustments.push({
          label: rule.label || `Seasonal (${seasonalDays} days)`,
          amount,
          type: rule.value > 0 ? 'surcharge' : 'discount',
        })
        break
      }
    }
  }

  const adjustmentSum = adjustments.reduce((sum, a) => sum + a.amount * (a.type === 'discount' ? -1 : 1), 0)
  const total = Math.max(0, baseTotal + adjustmentSum)

  return {
    days,
    baseTotal,
    adjustments,
    deposit: baseDeposit,
    total,
    perDay: total / days,
  }
}

export function isWeekend(date: Date): boolean {
  const dow = date.getDay()
  return dow === 0 || dow === 6
}
