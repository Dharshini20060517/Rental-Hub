import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

const messageSchema = z.object({ message: z.string().min(1).max(2000), attachmentUrl: z.string().nullish() })

// GET /api/v1/bookings/[id]/messages — list messages for a booking
export const GET = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)

  const booking = await db.booking.findUnique({ where: { id }, select: { customerId: true, ownerId: true } })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (session.role !== 'admin' && booking.customerId !== session.id && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  const messages = await db.bookingMessage.findMany({
    where: { bookingId: id },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return ok(messages)
})

// POST /api/v1/bookings/[id]/messages — send a message
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const booking = await db.booking.findUnique({ where: { id }, select: { customerId: true, ownerId: true } })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (session.role !== 'admin' && booking.customerId !== session.id && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  const message = await db.bookingMessage.create({
    data: {
      bookingId: id,
      senderId: session.id,
      message: parsed.data.message,
      attachmentUrl: parsed.data.attachmentUrl || null,
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  })

  return ok(message, 201)
})
