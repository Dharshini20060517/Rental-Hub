import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import crypto from 'crypto'

const actionSchema = z.object({
  action: z.enum(['release', 'refund']),
  amount: z.number().min(0).optional(),
})

// POST /api/v1/bookings/[id]/payments/[paymentId] — release deposit or refund payment
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, paymentId } = await getParams(ctx)
  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const payment = await db.payment.findUnique({ where: { id: paymentId } })
  if (!payment || payment.bookingId !== id) throw new HttpError('NOT_FOUND', 'Payment not found.', 404)

  let result
  if (parsed.data.action === 'release') {
    result = await db.payment.create({
      data: {
        bookingId: id,
        userId: session.id,
        type: 'release',
        amount: parsed.data.amount ?? payment.amount,
        status: 'completed',
        reference: `sim_release_${crypto.randomBytes(8).toString('hex')}`,
      },
    })
    await audit({ action: 'DEPOSIT_RELEASED', resource: 'booking', resourceId: id, actorId: session.id })
  } else {
    result = await db.payment.create({
      data: {
        bookingId: id,
        userId: session.id,
        type: 'refund',
        amount: parsed.data.amount ?? payment.amount,
        status: 'completed',
        reference: `sim_refund_${crypto.randomBytes(8).toString('hex')}`,
      },
    })
    await audit({ action: 'PAYMENT_REFUNDED', resource: 'booking', resourceId: id, actorId: session.id })
  }

  return ok(result, 201)
})
