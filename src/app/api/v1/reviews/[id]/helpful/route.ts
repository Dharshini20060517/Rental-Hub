import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// POST /api/v1/reviews/[id]/helpful — toggle helpful vote on a review
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)

  const review = await db.review.findUnique({ where: { id } })
  if (!review || review.deletedAt || review.status !== 'published') {
    throw new HttpError('NOT_FOUND', 'Review not found.', 404)
  }

  // Can't vote on your own review
  if (review.reviewerId === session.id) {
    throw new HttpError('BAD_REQUEST', 'You cannot vote on your own review.', 400)
  }

  // Check existing vote
  const existing = await db.reviewHelpfulVote.findUnique({
    where: { reviewId_userId: { reviewId: id, userId: session.id } },
  })

  if (existing) {
    // Remove vote (toggle off)
    await db.$transaction([
      db.reviewHelpfulVote.delete({ where: { id: existing.id } }),
      db.review.update({ where: { id }, data: { helpfulVotes: { decrement: 1 } } }),
    ])
    return ok({ helpful: false, helpfulVotes: review.helpfulVotes - 1 })
  }

  // Add vote
  await db.$transaction([
    db.reviewHelpfulVote.create({ data: { reviewId: id, userId: session.id } }),
    db.review.update({ where: { id }, data: { helpfulVotes: { increment: 1 } } }),
  ])
  return ok({ helpful: true, helpfulVotes: review.helpfulVotes + 1 })
})
