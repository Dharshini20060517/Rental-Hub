import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/owner/revenue — projected monthly revenue trend (last 6 months) + per-listing performance
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const myEquipment = await db.equipment.findMany({
    where: { ownerId: session.id, deletedAt: null },
    select: {
      id: true, title: true, baseDailyPrice: true, status: true, createdAt: true,
      _count: { select: { wishlists: true, reviews: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const now = new Date()
  const months: { month: string; revenue: number; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const label = d.toLocaleDateString('en-IN', { month: 'short' })
    let revenue = 0
    for (const eq of myEquipment) {
      const created = new Date(eq.createdAt)
      if (created <= monthEnd && eq.status === 'active') {
        const monthsSince = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) - i)
        const utilization = Math.min(0.65, 0.15 + monthsSince * 0.08)
        revenue += eq.baseDailyPrice * 20 * utilization
      }
    }
    months.push({ month: d.toISOString(), revenue: Math.round(revenue), label })
  }

  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: myEquipment.map((e) => e.id) }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const performance = myEquipment.map((e) => ({
    id: e.id, title: e.title, status: e.status, baseDailyPrice: e.baseDailyPrice,
    monthlyProjection: Math.round(e.baseDailyPrice * 20 * (e.status === 'active' ? 0.45 : 0)),
    wishlists: e._count.wishlists, reviews: e._count.reviews,
    rating: ratingMap.get(e.id)?.avg ?? 0, reviewCount: ratingMap.get(e.id)?.count ?? 0,
    createdAt: e.createdAt,
  })).sort((a, b) => b.monthlyProjection - a.monthlyProjection)

  const totalProjectedMonthly = performance.reduce((sum, p) => sum + p.monthlyProjection, 0)

  return ok({
    months, performance, totalProjectedMonthly,
    avgMonthly: months.length > 0 ? Math.round(months.reduce((s, m) => s + m.revenue, 0) / months.length) : 0,
  })
})
