import { apiHandler } from '@/lib/handler'
import { ok, paged, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/wishlist — current user's wishlist with equipment details
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') || 24)))

  const [total, rows] = await Promise.all([
    db.wishlist.count({ where: { userId: session.id } }),
    db.wishlist.findMany({
      where: { userId: session.id },
      include: { equipment: { include: equipmentInclude } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: rows.map((r) => r.equipmentId) }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map(reviewAgg.map((a) => [a.equipmentId, { avg: a._avg.rating ?? 0, count: a._count }]))

  const data = rows
    .filter((r) => r.equipment && !r.equipment.deletedAt)
    .map((r) => ({
      id: r.id,
      equipmentId: r.equipmentId,
      createdAt: r.createdAt,
      equipment: {
        ...r.equipment,
        rating: ratingMap.get(r.equipmentId)?.avg ?? 0,
        reviewCount: ratingMap.get(r.equipmentId)?.count ?? 0,
      },
    }))

  return paged(data, page, limit, total)
})

// POST /api/v1/wishlist — body { equipmentId } — toggle add
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const body = await req.json()
  const equipmentId = body?.equipmentId
  if (!equipmentId) throw new HttpError('VALIDATION_ERROR', 'equipmentId required.', 422)

  const eq = await db.equipment.findUnique({ where: { id: equipmentId }, select: { deletedAt: true } })
  if (!eq || eq.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  const existing = await db.wishlist.findUnique({
    where: { userId_equipmentId: { userId: session.id, equipmentId } },
  })
  if (existing) throw new HttpError('CONFLICT', 'Already in wishlist.', 409)

  const wl = await db.wishlist.create({ data: { userId: session.id, equipmentId } })
  return ok(wl, 201)
})
