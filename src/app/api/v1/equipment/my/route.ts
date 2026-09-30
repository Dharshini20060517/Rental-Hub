import { apiHandler } from '@/lib/handler'
import { ok, paged } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/equipment/my — owner's own listings (any status)
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') || 12)))
  const status = sp.get('status') // optional filter

  const where: Record<string, unknown> = { ownerId: session.id, deletedAt: null }
  if (status) where.status = status

  const [total, rows] = await Promise.all([
    db.equipment.count({ where: where as never }),
    db.equipment.findMany({
      where: where as never,
      include: equipmentInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: rows.map((r) => r.id) }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const data = rows.map((it) => ({
    ...it,
    rating: ratingMap.get(it.id)?.avg ?? 0,
    reviewCount: ratingMap.get(it.id)?.count ?? 0,
  }))

  return paged(data, page, limit, total)
})
