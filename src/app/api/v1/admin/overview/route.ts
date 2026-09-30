import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { calculateHealthScore } from '@/lib/health-score'

// GET /api/v1/admin/overview — platform health KPIs
export const GET = apiHandler(async () => {
  await requireAuth(['admin'])

  const allEquipment = await db.equipment.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      status: true,
      baseDailyPrice: true,
      baseDeposit: true,
      baseHourlyPrice: true,
      replacementValue: true,
      city: true,
      lat: true,
      lng: true,
      conditionNotes: true,
      pricingRules: true,
      images: { select: { id: true, isPrimary: true } },
      specs: { select: { key: true } },
      _count: { select: { reviews: true, wishlists: true } },
    },
  })

  // Compute health scores for all listings
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  let totalHealthScore = 0
  let activeCount = 0
  let totalPrice = 0
  let withLocation = 0
  let withPricingRules = 0
  let withImages3plus = 0
  let withSpecs3plus = 0

  for (const eq of allEquipment) {
    const rating = ratingMap.get(eq.id)
    const health = calculateHealthScore({
      status: eq.status,
      imageCount: eq.images.length,
      specCount: eq.specs.length,
      hasPricingRules: Array.isArray(eq.pricingRules) && eq.pricingRules.length > 0,
      hasLocation: !!eq.city && eq.lat !== null && eq.lng !== null,
      reviewCount: rating?.count ?? 0,
      avgRating: rating?.avg ?? 0,
      hasConditionNotes: !!eq.conditionNotes,
      hasHourlyPrice: eq.baseHourlyPrice !== null,
      hasReplacementValue: eq.replacementValue !== null,
    })
    totalHealthScore += health.score
    if (eq.status === 'active') activeCount++
    totalPrice += eq.baseDailyPrice
    if (eq.city && eq.lat !== null && eq.lng !== null) withLocation++
    if (Array.isArray(eq.pricingRules) && eq.pricingRules.length > 0) withPricingRules++
    if (eq.images.length >= 3) withImages3plus++
    if (eq.specs.length >= 3) withSpecs3plus++
  }

  const count = allEquipment.length
  const avgHealthScore = count > 0 ? Math.round(totalHealthScore / count) : 0
  const avgListingPrice = count > 0 ? Math.round(totalPrice / count) : 0
  const activeRate = count > 0 ? Math.round((activeCount / count) * 100) : 0
  const platformUtilization = Math.round(activeRate * 0.45) // estimated: 45% of active listings rented at any time
  const locationCoverage = count > 0 ? Math.round((withLocation / count) * 100) : 0
  const pricingRulesCoverage = count > 0 ? Math.round((withPricingRules / count) * 100) : 0
  const imageQualityRate = count > 0 ? Math.round((withImages3plus / count) * 100) : 0
  const specCompletenessRate = count > 0 ? Math.round((withSpecs3plus / count) * 100) : 0

  // Health grade distribution
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0 }
  for (const eq of allEquipment) {
    const rating = ratingMap.get(eq.id)
    const health = calculateHealthScore({
      status: eq.status,
      imageCount: eq.images.length,
      specCount: eq.specs.length,
      hasPricingRules: Array.isArray(eq.pricingRules) && eq.pricingRules.length > 0,
      hasLocation: !!eq.city && eq.lat !== null && eq.lng !== null,
      reviewCount: rating?.count ?? 0,
      avgRating: rating?.avg ?? 0,
      hasConditionNotes: !!eq.conditionNotes,
      hasHourlyPrice: eq.baseHourlyPrice !== null,
      hasReplacementValue: eq.replacementValue !== null,
    })
    gradeCounts[health.grade]++
  }

  return ok({
    avgHealthScore,
    avgListingPrice,
    activeRate,
    platformUtilization,
    locationCoverage,
    pricingRulesCoverage,
    imageQualityRate,
    specCompletenessRate,
    gradeDistribution: gradeCounts,
    totalListings: count,
  })
})
