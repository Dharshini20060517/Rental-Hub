import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/admin/stats — platform analytics (adapted MongoDB aggregations to Prisma groupBy)
export const GET = apiHandler(async () => {
  await requireAuth(['admin'])

  const [usersByRole, equipmentByStatus, equipmentByCategory, reviewsAgg, recentAuditCount] =
    await Promise.all([
      db.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: true }),
      db.equipment.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
      db.equipment.groupBy({ by: ['categoryId'], where: { deletedAt: null }, _count: true }),
      db.review.aggregate({ where: { status: 'published', deletedAt: null }, _avg: { rating: true }, _count: true }),
      db.auditLog.count({ where: { createdAt: { gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } } }),
    ])

  const catIds = equipmentByCategory.map((c) => c.categoryId)
  const cats = await db.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
  const catMap = new Map(cats.map((c) => [c.id, c.name]))

  return ok({
    totals: {
      users: await db.user.count({ where: { deletedAt: null } }),
      equipment: await db.equipment.count({ where: { deletedAt: null } }),
      reviews: reviewsAgg._count,
      avgRating: reviewsAgg._avg.rating ?? 0,
      auditLast7d: recentAuditCount,
      wishlists: await db.wishlist.count(),
    },
    usersByRole: usersByRole.map((u) => ({ role: u.role, count: u._count })),
    equipmentByStatus: equipmentByStatus.map((e) => ({ status: e.status, count: e._count })),
    equipmentByCategory: equipmentByCategory.map((e) => ({
      categoryId: e.categoryId,
      name: catMap.get(e.categoryId) ?? 'Unknown',
      count: e._count,
    })),
  })
})
