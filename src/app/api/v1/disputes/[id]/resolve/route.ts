import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

const resolveSchema = z.object({
  resolution: z.enum(['refund_customer', 'favor_owner', 'split', 'warning']),
  resolutionNote: z.string().max(2000).optional(),
})

// POST /api/v1/disputes/[id]/resolve — admin resolves a dispute
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const dispute = await db.dispute.findUnique({ where: { id }, select: { id: true, status: true, bookingId: true } })
  if (!dispute) throw new HttpError('NOT_FOUND', 'Dispute not found.', 404)
  if (dispute.status === 'resolved' || dispute.status === 'closed') {
    throw new HttpError('BAD_REQUEST', 'Dispute already resolved.', 400)
  }

  const updated = await db.dispute.update({
    where: { id },
    data: {
      status: 'resolved',
      resolution: parsed.data.resolution,
      resolutionNote: parsed.data.resolutionNote || null,
      resolvedById: session.id,
      resolvedAt: new Date(),
    },
  })

  // If resolution favors customer, process refund
  if (parsed.data.resolution === 'refund_customer') {
    const booking = await db.booking.findUnique({ where: { id: dispute.bookingId }, select: { totalAmount: true } })
    if (booking) {
      await db.payment.create({
        data: {
          bookingId: dispute.bookingId,
          userId: session.id,
          type: 'refund',
          amount: booking.totalAmount,
          status: 'completed',
          reference: `dispute_refund_${dispute.id}`,
        },
      })
    }
  }

  // Update booking back to completed or cancelled
  await db.booking.update({ where: { id: dispute.bookingId }, data: { status: 'completed', completedAt: new Date() } })

  await audit({ action: 'DISPUTE_RESOLVED', resource: 'dispute', resourceId: id, actorId: session.id, metadata: parsed.data })
  return ok(updated)
})
