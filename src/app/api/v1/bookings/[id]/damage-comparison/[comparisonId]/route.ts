import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

const reviewSchema = z.object({
  status: z.enum(['confirmed', 'rejected']),
  findingIndex: z.number().int().min(0).optional(),
})

// PATCH /api/v1/bookings/[id]/damage-comparison/[comparisonId] — confirm or reject AI findings
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, comparisonId } = await getParams(ctx)
  const body = await req.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const comparison = await db.damageComparison.findUnique({ where: { id: comparisonId } })
  if (!comparison || comparison.bookingId !== id) throw new HttpError('NOT_FOUND', 'Comparison not found.', 404)

  const booking = await db.booking.findUnique({ where: { id }, select: { ownerId: true } })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (session.role !== 'admin' && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Only the owner or admin can review findings.', 403)
  }

  const updated = await db.damageComparison.update({
    where: { id: comparisonId },
    data: {
      status: parsed.data.status,
      reviewedById: session.id,
      reviewedAt: new Date(),
    },
  })

  await audit({ action: 'AI_FINDING_REVIEWED', resource: 'booking', resourceId: id, actorId: session.id, metadata: { comparisonId, status: parsed.data.status } })

  return ok(updated)
})
