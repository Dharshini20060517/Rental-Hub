import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/users/[id]/profile — public owner profile + their other active listings
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const excludeId = sp.get('exclude') // current equipment id to exclude from "other listings"

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true,
      accountType: true, businessName: true, registrationNumber: true,
      avatarUrl: true, phone: true, bio: true, isVerified: true, createdAt: true,
    },
  })

  if (!user || user.role !== 'owner') {
    throw new HttpError('NOT_FOUND', 'Owner not found.', 404)
  }

  // Aggregated stats
  const [listingsCount, reviewsAgg] = await Promise.all([
    db.equipment.count({ where: { ownerId: id, deletedAt: null, status: 'active' } }),
    db.review.aggregate({
      where: { receiverId: id, status: 'published', deletedAt: null },
      _avg: { rating: true },
      _count: true,
    }),
  ])

  // Other active listings (exclude current equipment)
  const where: Record<string, unknown> = { ownerId: id, deletedAt: null, status: 'active' }
  if (excludeId) where.id = { not: excludeId }

  const otherListings = await db.equipment.findMany({
    where: where as never,
    include: equipmentInclude,
    orderBy: { createdAt: 'desc' },
    take: 6,
  })

  // Rating aggregates for other listings
  const ids = otherListings.map((e) => e.id)
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: ids }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const listings = otherListings.map((e) => ({
    ...e,
    rating: ratingMap.get(e.id)?.avg ?? 0,
    reviewCount: ratingMap.get(e.id)?.count ?? 0,
    wishlistCount: e._count?.wishlists ?? 0,
  }))

  return ok({
    owner: {
      ...user,
      // Don't expose email for privacy unless they want contact
      email: null,
    },
    stats: {
      listingsCount,
      avgRating: reviewsAgg._avg.rating ?? 0,
      reviewsCount: reviewsAgg._count,
      memberSince: user.createdAt,
    },
    listings,
  })
})
