import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).nullish(),
  body: z.string().max(4000).nullish(),
})

// POST /api/v1/bookings/[id]/review — two-way review after COMPLETED
// Customer rates the equipment; Owner rates the customer
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const booking = await db.booking.findUnique({
    where: { id },
    select: { id: true, status: true, customerId: true, ownerId: true, equipmentId: true },
  })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (booking.status !== 'completed') throw new HttpError('BAD_REQUEST', 'Reviews can only be left after booking completion.', 400)

  const isCustomer = session.id === booking.customerId
  const isOwner = session.id === booking.ownerId
  if (!isCustomer && !isOwner) throw new HttpError('FORBIDDEN', 'Not authorized to review this booking.', 403)

  // Determine review target
  const receiverId = isCustomer ? booking.ownerId : booking.customerId
  const equipmentId = isCustomer ? booking.equipmentId : null

  // Check existing review for this booking by this user
  const existing = await db.review.findFirst({
    where: { reviewerId: session.id, receiverId, equipmentId },
  })
  if (existing) throw new HttpError('CONFLICT', 'You have already reviewed this booking.', 409)

  const review = await db.review.create({
    data: {
      reviewerId: session.id,
      receiverId,
      equipmentId,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body || null,
      status: 'published',
    },
  })

  // Update trust score based on the rating
  const receiver = await db.user.findUnique({ where: { id: receiverId }, select: { trustScore: true } })
  if (receiver) {
    const newScore = Math.max(0, Math.min(100, (receiver.trustScore || 50) + (parsed.data.rating - 3) * 2))
    await db.user.update({ where: { id: receiverId }, data: { trustScore: newScore } })
  }

  // Create notification for the receiver
  await db.notification.create({
    data: {
      userId: receiverId,
      type: 'review',
      title: `${parsed.data.rating}★ review received`,
      message: isCustomer
        ? `Your equipment received a ${parsed.data.rating}-star review.`
        : `You received a ${parsed.data.rating}-star review as a customer.`,
      data: { reviewId: review.id, bookingId: id, equipmentId } as never,
      isRead: false,
    },
  }).catch(() => {})

  await audit({ action: 'BOOKING_REVIEW_CREATED', resource: 'review', resourceId: review.id, actorId: session.id, metadata: { bookingId: id, rating: parsed.data.rating, role: isCustomer ? 'customer' : 'owner' } })
  return ok(review, 201)
})
