import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/equipment/compare?ids=a,b,c (max 3)
export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const raw = sp.get('ids') || ''
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.length < 2) throw new HttpError('VALIDATION_ERROR', 'Provide at least 2 equipment ids.', 422)
  if (ids.length > 3) throw new HttpError('VALIDATION_ERROR', 'You can compare at most 3 items.', 422)

  const items = await db.equipment.findMany({
    where: { id: { in: ids }, deletedAt: null, status: { in: ['active', 'paused'] } },
    include: equipmentInclude,
  })

  // preserve requested order
  const orderMap = new Map(ids.map((id, i) => [id, i]))
  items.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99))

  // attach ratings
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: ids }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const data = items.map((it) => ({
    ...it,
    rating: ratingMap.get(it.id)?.avg ?? 0,
    reviewCount: ratingMap.get(it.id)?.count ?? 0,
  }))

  return ok(data, 200, { page: 1, limit: 3, total: data.length, totalPages: 1 })
})
