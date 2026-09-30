import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/equipment/trending?limit=8 — most-wishlisted active equipment
export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const limit = Math.min(20, Math.max(1, Number(sp.get('limit') || 8)))

  // Count wishlists per equipment (simple groupBy without orderBy)
  const wishAgg = await db.wishlist.groupBy({
    by: ['equipmentId'],
    _count: { _all: true },
  })

  // Sort by count desc in JS
  wishAgg.sort((a, b) => b._count._all - a._count._all)

  if (wishAgg.length === 0) {
    const fallback = await db.equipment.findMany({
      where: { deletedAt: null, status: 'active' },
      include: equipmentInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return ok(fallback.map((e) => ({ ...e, wishlistCount: 0, rating: 0, reviewCount: 0 })))
  }

  const topIds = wishAgg.slice(0, limit).map((w) => w.equipmentId)
  const wishCountMap = new Map(wishAgg.map((w) => [w.equipmentId, w._count._all]))

  const items = await db.equipment.findMany({
    where: { id: { in: topIds }, deletedAt: null, status: 'active' },
    include: equipmentInclude,
  })

  // Sort by wishlist count (matching the aggregation order)
  const orderMap = new Map(topIds.map((id, i) => [id, i]))
  items.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99))

  // Attach ratings
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: topIds }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count._all }]))

  const data = items.map((e) => ({
    ...e,
    rating: ratingMap.get(e.id)?.avg ?? 0,
    reviewCount: ratingMap.get(e.id)?.count ?? 0,
    wishlistCount: wishCountMap.get(e.id) ?? 0,
  }))

  return ok(data)
})
