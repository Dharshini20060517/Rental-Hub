import { apiHandler, getParams } from '@/lib/handler'
import { ok, paged, HttpError } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { userSelect } from '@/lib/serializers'

// GET /api/v1/equipment/[id]/reviews?sort=helpful|newest|highest|lowest&page=1&limit=10
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit') || 10)))
  const sort = sp.get('sort') || 'newest'

  const item = await db.equipment.findUnique({ where: { id }, select: { deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  const session = await getSession()
  const where = { equipmentId: id, status: 'published', deletedAt: null }

  // Determine sort order
  let orderBy: Record<string, string>
  switch (sort) {
    case 'helpful':
      orderBy = { helpfulVotes: 'desc' }
      break
    case 'highest':
      orderBy = { rating: 'desc' }
      break
    case 'lowest':
      orderBy = { rating: 'asc' }
      break
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' }
      break
  }

  const [total, rows] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      include: {
        reviewer: { select: userSelect },
        helpfulVoters: session ? { where: { userId: session.id }, select: { id: true } } : false,
      },
      orderBy: [orderBy, { createdAt: 'desc' }] as never,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  // Map to include `userVoted` boolean
  const data = rows.map((r) => {
    const { helpfulVoters, ...rest } = r
    return {
      ...rest,
      userVoted: helpfulVoters && helpfulVoters.length > 0,
    }
  })

  return paged(data, page, limit, total)
})
