import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/intelligence/pricing-suggestions — demand-aware pricing suggestions for the owner's listings
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const myEquipment = await db.equipment.findMany({
    where: { ownerId: session.id, deletedAt: null, status: 'active' },
    select: {
      id: true, title: true, baseDailyPrice: true, categoryId: true, city: true,
      createdAt: true,
      _count: { select: { wishlists: true, reviews: true, bookings: true } },
    },
  })

  if (myEquipment.length === 0) return ok([])

  const suggestions = []

  for (const eq of myEquipment) {
    // Compute suggestion based on: wishlist interest, review count, booking count, age
    const wishlistCount = eq._count.wishlists
    const reviewCount = eq._count.reviews
    const bookingCount = eq._count.bookings
    const monthsSinceListed = Math.max(1, Math.round((Date.now() - eq.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)))

    // Get category average price
    const siblings = await db.equipment.findMany({
      where: { categoryId: eq.categoryId, deletedAt: null, status: 'active', id: { not: eq.id } },
      select: { baseDailyPrice: true },
    })
    const catAvg = siblings.length > 0 ? siblings.reduce((s, e) => s + e.baseDailyPrice, 0) / siblings.length : eq.baseDailyPrice

    // Demand score: higher = more demand relative to supply
    const demandScore = (wishlistCount * 2 + reviewCount * 3 + bookingCount * 1) / monthsSinceListed

    // Seasonality: adjust based on current month (peak/off-peak)
    const month = new Date().getMonth()
    const isPeakSeason = [10, 11, 0, 1, 2, 5, 6].includes(month) // Nov-Feb (winter events), Jun-Jul (summer)
    const seasonalityMultiplier = isPeakSeason ? 1.1 : 1.0

    // Lead time: average days between booking creation and start date (shorter = higher demand)
    const recentBookings = await db.booking.findMany({
      where: { equipmentId: eq.id, status: { not: 'cancelled' } },
      select: { createdAt: true, startDate: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
    let avgLeadTime = 7 // default
    if (recentBookings.length > 0) {
      const leadTimes = recentBookings.map(b => Math.max(0, (b.startDate.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
      avgLeadTime = Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
    }

    // Competitor price band: min/max of category
    const catPrices = siblings.map(s => s.baseDailyPrice)
    const catMin = catPrices.length > 0 ? Math.min(...catPrices) : eq.baseDailyPrice
    const catMax = catPrices.length > 0 ? Math.max(...catPrices) : eq.baseDailyPrice

    // Suggested price logic (rule-based with seasonality + lead time):
    let suggestedPrice = eq.baseDailyPrice
    let confidence = 0.5
    let reasoning = 'Your price is well-aligned with market rates.'

    // Seasonal adjustment
    if (isPeakSeason && eq.baseDailyPrice < catAvg * seasonalityMultiplier) {
      suggestedPrice = Math.round(eq.baseDailyPrice * 1.1)
      confidence = 0.65
      reasoning = `Peak season detected. Your price is below the category average of ${Math.round(catAvg)}. Consider a 10% seasonal surcharge.`
    } else if (demandScore > 5 && eq.baseDailyPrice < catAvg * 0.9) {
      suggestedPrice = Math.round(eq.baseDailyPrice * 1.15)
      confidence = 0.75
      reasoning = `High demand (${wishlistCount} wishlists, ${bookingCount} bookings) but price is below category average. Consider raising 15%.`
    } else if (demandScore < 0.5 && eq.baseDailyPrice > catAvg * 1.1) {
      suggestedPrice = Math.round(eq.baseDailyPrice * 0.9)
      confidence = 0.7
      reasoning = `Low demand (${bookingCount} bookings in ${monthsSinceListed} months) and price is above category average. Consider lowering 10%.`
    } else if (eq.baseDailyPrice < catAvg * 0.8) {
      suggestedPrice = Math.round(catAvg * 0.95)
      confidence = 0.65
      reasoning = 'Price is significantly below category average. Aligning closer to market could increase revenue without reducing demand.'
    }

    suggestions.push({
      equipmentId: eq.id,
      title: eq.title,
      currentPrice: eq.baseDailyPrice,
      suggestedPrice,
      confidence,
      reasoning,
      inputs: {
        wishlistCount, reviewCount, bookingCount, monthsSinceListed,
        categoryAverage: Math.round(catAvg),
        categoryMin: catMin,
        categoryMax: catMax,
        demandScore: Math.round(demandScore * 100) / 100,
        seasonality: isPeakSeason ? 'peak' : 'off-peak',
        avgLeadTimeDays: avgLeadTime,
      },
    })
  }

  // Save suggestions to DB
  for (const s of suggestions) {
    await db.priceSuggestion.create({
      data: {
        equipmentId: s.equipmentId,
        suggestedPrice: s.suggestedPrice,
        confidence: s.confidence,
        reasoning: s.reasoning,
        inputs: s.inputs as never,
      },
    }).catch(() => {}) // ignore duplicates
  }

  return ok(suggestions)
})
