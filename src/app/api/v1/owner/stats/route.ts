import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { calculateHealthScore } from '@/lib/health-score'

// GET /api/v1/owner/stats — dashboard analytics for the logged-in owner
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const myEquipment = await db.equipment.findMany({
    where: { ownerId: session.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      baseDailyPrice: true,
      baseDeposit: true,
      city: true,
      lat: true,
      lng: true,
      baseHourlyPrice: true,
      replacementValue: true,
      conditionNotes: true,
      pricingRules: true,
      createdAt: true,
      images: { select: { url: true, isPrimary: true }, orderBy: { order: 'asc' } },
      specs: { select: { key: true } },
      _count: { select: { wishlists: true, reviews: true, maintenanceLogs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (myEquipment.length === 0) {
    return ok({
      totals: { listings: 0, activeListings: 0, totalWishlists: 0, totalReviews: 0, avgRating: 0, totalMaintenanceCost: 0, potentialMonthlyRevenue: 0 },
      byStatus: [],
      topListings: [],
      recentMaintenance: [],
    })
  }

  const ids = myEquipment.map((e) => e.id)

  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: ids }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const overallRating = await db.review.aggregate({
    where: { receiverId: session.id, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })

  const wishCount = await db.wishlist.count({ where: { equipmentId: { in: ids } } })

  const maintAgg = await db.maintenanceLog.aggregate({
    where: { ownerId: session.id },
    _sum: { cost: true },
    _count: true,
  })

  const recentMaintenance = await db.maintenanceLog.findMany({
    where: { ownerId: session.id },
    orderBy: { performedAt: 'desc' },
    take: 5,
    select: { id: true, title: true, cost: true, performedAt: true, equipment: { select: { title: true } } },
  })

  const statusMap = new Map<string, number>()
  myEquipment.forEach((e) => { statusMap.set(e.status, (statusMap.get(e.status) || 0) + 1) })

  const topListings = myEquipment
    .map((e) => {
      const ratingInfo = ratingMap.get(e.id)
      const health = calculateHealthScore({
        status: e.status,
        imageCount: e.images.length,
        specCount: e.specs.length,
        hasPricingRules: Array.isArray(e.pricingRules) && e.pricingRules.length > 0,
        hasLocation: !!e.city && e.lat !== null && e.lng !== null,
        reviewCount: ratingInfo?.count ?? 0,
        avgRating: ratingInfo?.avg ?? 0,
        hasConditionNotes: !!e.conditionNotes,
        hasHourlyPrice: e.baseHourlyPrice !== null,
        hasReplacementValue: e.replacementValue !== null,
      })
      return {
        id: e.id, title: e.title, status: e.status, baseDailyPrice: e.baseDailyPrice, city: e.city,
        coverUrl: e.images.find((i) => i.isPrimary)?.url ?? e.images[0]?.url ?? null,
        wishlists: e._count.wishlists, reviews: e._count.reviews,
        rating: ratingInfo?.avg ?? 0, reviewCount: ratingInfo?.count ?? 0, maintenanceLogs: e._count.maintenanceLogs,
        healthScore: health.score, healthGrade: health.grade, healthChecks: health.checks,
      }
    })
    .sort((a, b) => b.wishlists - a.wishlists || b.rating - a.rating)
    .slice(0, 5)

  const potentialMonthlyRevenue = myEquipment.filter((e) => e.status === 'active').reduce((sum, e) => sum + e.baseDailyPrice * 20, 0)

  return ok({
    totals: {
      listings: myEquipment.length,
      activeListings: myEquipment.filter((e) => e.status === 'active').length,
      totalWishlists: wishCount,
      totalReviews: overallRating._count,
      avgRating: overallRating._avg.rating ?? 0,
      totalMaintenanceCost: maintAgg._sum.cost ?? 0,
      maintenanceCount: maintAgg._count,
      potentialMonthlyRevenue,
    },
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    topListings,
    recentMaintenance: recentMaintenance.map((m) => ({ id: m.id, title: m.title, cost: m.cost, performedAt: m.performedAt, equipmentTitle: m.equipment.title })),
  })
})
