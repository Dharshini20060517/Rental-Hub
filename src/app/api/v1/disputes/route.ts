import { apiHandler, getParams } from '@/lib/handler'
import { ok, paged, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

const raiseSchema = z.object({
  bookingId: z.string().cuid(),
  reason: z.enum(['damage', 'late_return', 'wrong_item', 'payment', 'other']),
  description: z.string().min(10).max(2000),
  evidenceUrls: z.array(z.string()).max(10).optional(),
})

// POST /api/v1/disputes — raise a dispute
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const body = await req.json()
  const parsed = raiseSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true, customerId: true, ownerId: true, status: true },
  })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (booking.customerId !== session.id && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'You can only raise disputes on your own bookings.', 403)
  }

  const againstId = booking.customerId === session.id ? booking.ownerId : booking.customerId

  const dispute = await db.dispute.create({
    data: {
      bookingId: parsed.data.bookingId,
      raisedById: session.id,
      againstId,
      reason: parsed.data.reason,
      description: parsed.data.description,
      evidenceUrls: parsed.data.evidenceUrls || null,
      status: 'open',
    },
  })

  // Update booking status to disputed
  await db.booking.update({ where: { id: booking.id }, data: { status: 'disputed' } })

  await audit({ action: 'DISPUTE_RAISED', resource: 'dispute', resourceId: dispute.id, actorId: session.id })
  return ok(dispute, 201)
})

// GET /api/v1/disputes — list disputes (role-scoped)
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit') || 20)))
  const status = sp.get('status')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (session.role === 'customer') {
    where.OR = [{ raisedById: session.id }, { againstId: session.id }]
  } else if (session.role === 'owner') {
    where.OR = [{ raisedById: session.id }, { againstId: session.id }]
  }
  // admin sees all

  const [total, rows] = await Promise.all([
    db.dispute.count({ where: where as never }),
    db.dispute.findMany({
      where: where as never,
      include: {
        booking: { select: { id: true, equipment: { select: { id: true, title: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } } } },
        raisedBy: { select: { id: true, name: true, avatarUrl: true } },
        against: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return paged(rows, page, limit, total)
})
