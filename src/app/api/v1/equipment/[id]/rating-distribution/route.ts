import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { db } from '@/lib/db'

// GET /api/v1/equipment/[id]/rating-distribution — star breakdown (5★ to 1★)
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  // Group reviews by rating
  const grouped = await db.review.groupBy({
    by: ['rating'],
    where: { equipmentId: id, status: 'published', deletedAt: null },
    _count: { _all: true },
  })

  // Build distribution array [5,4,3,2,1]
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const entry = grouped.find((g) => g.rating === stars)
    return { stars, count: entry?._count._all || 0 }
  })

  const total = distribution.reduce((sum, d) => sum + d.count, 0)
  const sumRating = distribution.reduce((sum, d) => sum + d.stars * d.count, 0)
  const avg = total > 0 ? sumRating / total : 0

  return ok({ distribution, total, avg })
})
