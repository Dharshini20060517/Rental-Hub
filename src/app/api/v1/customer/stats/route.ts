import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/customer/stats — dashboard analytics for the logged-in customer
export const GET = apiHandler(async () => {
  const session = await requireAuth(['customer', 'admin'])

  const [wishlistCount, reviewsCount, avgRatingGiven] = await Promise.all([
    db.wishlist.count({ where: { userId: session.id } }),
    db.review.count({ where: { reviewerId: session.id, deletedAt: null } }),
    db.review.aggregate({ where: { reviewerId: session.id, deletedAt: null }, _avg: { rating: true } }),
  ])

  // Wishlist items with equipment details (recent 8)
  const wishlist = await db.wishlist.findMany({
    where: { userId: session.id },
    include: {
      equipment: {
        select: {
          id: true, title: true, baseDailyPrice: true, city: true, status: true,
          images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  // Reviews written by user (recent 5)
  const recentReviews = await db.review.findMany({
    where: { reviewerId: session.id, deletedAt: null },
    include: {
      equipment: { select: { id: true, title: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // Recommended: top-rated equipment (not in wishlist) — use full include for EquipmentCard
  const wishlistIds = wishlist.map((w) => w.equipmentId)
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const recommendedRaw = await db.equipment.findMany({
    where: { id: { notIn: wishlistIds }, deletedAt: null, status: 'active' },
    include: equipmentInclude,
    take: 30,
  })

  const recommended = recommendedRaw
    .map((e) => ({
      ...e,
      rating: ratingMap.get(e.id)?.avg ?? 0,
      reviewCount: ratingMap.get(e.id)?.count ?? 0,
      wishlistCount: e._count?.wishlists ?? 0,
    }))
    .sort((a, b) => b.rating - a.rating || b.wishlistCount - a.wishlistCount)
    .slice(0, 4)

  return ok({
    totals: {
      wishlistCount,
      reviewsCount,
      avgRatingGiven: avgRatingGiven._avg.rating ?? 0,
    },
    wishlist: wishlist.map((w) => ({
      id: w.id,
      equipmentId: w.equipmentId,
      createdAt: w.createdAt,
      equipment: w.equipment,
    })),
    recentReviews: recentReviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt,
      equipment: r.equipment,
    })),
    recommended,
  })
})
