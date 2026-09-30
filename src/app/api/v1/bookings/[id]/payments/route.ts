import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import crypto from 'crypto'

const holdSchema = z.object({ idempotencyKey: z.string().optional() })

// POST /api/v1/bookings/[id]/payments — create a payment (hold deposit + charge rental)
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json().catch(() => ({}))
  const parsed = holdSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const booking = await db.booking.findUnique({ where: { id } })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (booking.customerId !== session.id) throw new HttpError('FORBIDDEN', 'Only the customer can pay.', 403)
  if (booking.status !== 'held') throw new HttpError('BAD_REQUEST', 'Booking must be in held state to pay.', 400)

  // Idempotency
  const idemKey = parsed.data.idempotencyKey || `pay-${booking.id}`
  const existing = await db.payment.findUnique({ where: { idempotencyKey: idemKey } })
  if (existing) return ok(existing)

  // Simulated payment: hold deposit + charge rental
  const chargePayment = await db.payment.create({
    data: {
      bookingId: id,
      userId: session.id,
      type: 'charge',
      amount: booking.totalAmount,
      status: 'completed',
      reference: `sim_charge_${crypto.randomBytes(8).toString('hex')}`,
      idempotencyKey: idemKey,
    },
  })

  const holdPayment = await db.payment.create({
    data: {
      bookingId: id,
      userId: session.id,
      type: 'hold',
      amount: booking.depositAmount,
      status: 'completed',
      reference: `sim_hold_${crypto.randomBytes(8).toString('hex')}`,
    },
  })

  // Confirm the booking
  const { BookingService } = await import('@/lib/booking-service')
  await BookingService.confirmBooking(id, session.id)

  await audit({ action: 'PAYMENT_HOLD', resource: 'booking', resourceId: id, actorId: session.id, metadata: { amount: booking.totalAmount + booking.depositAmount } })

  return ok({ charge: chargePayment, hold: holdPayment, bookingStatus: 'confirmed' }, 201)
})
