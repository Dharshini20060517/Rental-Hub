import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { reviewSchema } from '@/lib/validators'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// POST /api/v1/reviews — customer creates a review (Phase 1: schema only, basic create)
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'admin'])
  const body = await req.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const receiver = await db.user.findUnique({ where: { id: parsed.data.receiverId } })
  if (!receiver) throw new HttpError('NOT_FOUND', 'Receiver not found.', 404)
  if (receiver.id === session.id) throw new HttpError('VALIDATION_ERROR', 'Cannot review yourself.', 422)

  if (parsed.data.equipmentId) {
    const eq = await db.equipment.findUnique({ where: { id: parsed.data.equipmentId } })
    if (!eq) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  }

  const existing = await db.review.findFirst({
    where: { reviewerId: session.id, receiverId: parsed.data.receiverId, equipmentId: parsed.data.equipmentId ?? null },
  })
  if (existing) throw new HttpError('CONFLICT', 'You have already reviewed this.', 409)

  const review = await db.review.create({
    data: {
      reviewerId: session.id,
      receiverId: parsed.data.receiverId,
      equipmentId: parsed.data.equipmentId ?? null,
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      body: parsed.data.body ?? null,
    },
  })
  await audit({ action: 'REVIEW_CREATED', resource: 'review', resourceId: review.id, actorId: session.id })
  return ok(review, 201)
})
