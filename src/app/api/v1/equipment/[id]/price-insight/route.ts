import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { db } from '@/lib/db'

// GET /api/v1/equipment/[id]/price-insight — compares this listing's price vs category average
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)

  const item = await db.equipment.findUnique({
    where: { id },
    select: { categoryId: true, baseDailyPrice: true, baseDeposit: true, deletedAt: true, title: true },
  })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  // All active equipment in the same category
  const siblings = await db.equipment.findMany({
    where: { categoryId: item.categoryId, deletedAt: null, status: 'active', id: { not: id } },
    select: { baseDailyPrice: true, baseDeposit: true },
  })

  const allPrices = [item.baseDailyPrice, ...siblings.map((s) => s.baseDailyPrice)]
  const allDeposits = [item.baseDeposit, ...siblings.map((s) => s.baseDeposit)]

  const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : item.baseDailyPrice
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : item.baseDailyPrice
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : item.baseDailyPrice
  const avgDeposit = allDeposits.length > 0 ? allDeposits.reduce((a, b) => a + b, 0) / allDeposits.length : item.baseDeposit

  const priceDiff = avgPrice > 0 ? Math.round(((item.baseDailyPrice - avgPrice) / avgPrice) * 100) : 0
  const depositDiff = avgDeposit > 0 ? Math.round(((item.baseDeposit - avgDeposit) / avgDeposit) * 100) : 0

  // Percentile rank (what % of listings are cheaper)
  const cheaperCount = siblings.filter((s) => s.baseDailyPrice < item.baseDailyPrice).length
  const percentile = siblings.length > 0 ? Math.round((cheaperCount / siblings.length) * 100) : 50

  let verdict: 'great_deal' | 'fair_price' | 'premium' | 'no_comparison'
  let verdictLabel: string
  let verdictColor: string

  if (siblings.length === 0) {
    verdict = 'no_comparison'
    verdictLabel = 'Only listing in category'
    verdictColor = 'text-muted-foreground'
  } else if (priceDiff <= -15) {
    verdict = 'great_deal'
    verdictLabel = 'Great deal'
    verdictColor = 'text-emerald-600'
  } else if (priceDiff <= 10) {
    verdict = 'fair_price'
    verdictLabel = 'Fair price'
    verdictColor = 'text-sky-600'
  } else {
    verdict = 'premium'
    verdictLabel = 'Premium priced'
    verdictColor = 'text-amber-600'
  }

  return ok({
    avgPrice: Math.round(avgPrice),
    minPrice,
    maxPrice,
    avgDeposit: Math.round(avgDeposit),
    priceDiff,
    depositDiff,
    percentile,
    siblingCount: siblings.length,
    verdict,
    verdictLabel,
    verdictColor,
  })
})
