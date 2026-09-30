import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/intelligence/recommendations — content-based + co-booking recommendations
// Query: ?type=for_you|frequently_together|similar&id=<equipmentId>
export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const type = sp.get('type') || 'for_you'
  const equipmentId = sp.get('id')

  if (type === 'similar' && equipmentId) {
    // Similar equipment (same category, excluding current)
    const item = await db.equipment.findUnique({ where: { id: equipmentId }, select: { categoryId: true } })
    if (!item) return ok([])

    const similar = await db.equipment.findMany({
      where: { categoryId: item.categoryId, deletedAt: null, status: 'active', id: { not: equipmentId } },
      include: equipmentInclude,
      take: 6,
    })
    return ok(similar.map((e, i) => ({ ...e, reason: 'Similar equipment in this category', matchScore: 100 - i * 10 })))
  }

  if (type === 'frequently_together' && equipmentId) {
    // Find equipment that was booked by the same customers who booked this equipment
    const itemBookings = await db.booking.findMany({
      where: { equipmentId, status: 'completed' },
      select: { customerId: true },
    })
    const customerIds = itemBookings.map(b => b.customerId)

    if (customerIds.length === 0) return ok([])

    const coBookings = await db.booking.findMany({
      where: { customerId: { in: customerIds }, equipmentId: { not: equipmentId }, status: 'completed' },
      include: { equipment: { include: equipmentInclude } },
      take: 20,
    })

    // Count co-occurrences
    const coMap = new Map<string, { count: number; equipment: typeof coBookings[number]['equipment'] }>()
    for (const b of coBookings) {
      const existing = coMap.get(b.equipmentId)
      if (existing) existing.count++
      else coMap.set(b.equipmentId, { count: 1, equipment: b.equipment })
    }

    const result = Array.from(coMap.entries())
      .map(([id, { count, equipment }]) => ({ ...equipment, reason: `Frequently rented together (${count}× by same customers)`, matchScore: count * 20 }))
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      .slice(0, 4)

    return ok(result)
  }

  // Default: "Recommended for you" — top-rated + most-wishlisted
  const session = await requireAuth(['customer', 'admin']).catch(() => null)

  // Get user's wishlist categories for personalization
  let userCategories: string[] = []
  if (session) {
    const wishlist = await db.wishlist.findMany({
      where: { userId: session.id },
      include: { equipment: { select: { categoryId: true } } },
    })
    userCategories = [...new Set(wishlist.map(w => w.equipment.categoryId))]
  }

  const where: Record<string, unknown> = { deletedAt: null, status: 'active' }
  if (userCategories.length > 0) where.categoryId = { in: userCategories }

  const items = await db.equipment.findMany({
    where: where as never,
    include: equipmentInclude,
    take: 30,
  })

  // Score by wishlist count + review count + rating
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map(a => [a.eipmentId || a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const scored = items.map((e) => {
    const r = ratingMap.get(e.id)
    const rating = r?.avg ?? 0
    const reviewCount = r?.count ?? 0
    const wishlistCount = e._count?.wishlists ?? 0
    const matchScore = rating * 20 + reviewCount * 5 + wishlistCount * 3
    return { ...e, rating, reviewCount, wishlistCount, matchScore, reason: userCategories.length > 0 ? 'Based on your wishlist interests' : 'Top-rated equipment' }
  }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 6)

  return ok(scored)
})
