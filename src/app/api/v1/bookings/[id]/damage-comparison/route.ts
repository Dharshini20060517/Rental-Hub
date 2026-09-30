import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { getVisionProvider } from '@/lib/vision-provider'
import { audit } from '@/lib/audit'

const compareSchema = {
  pickupPhotoUrl: String,
  returnPhotoUrl: String,
  angle: String,
}

// POST /api/v1/bookings/[id]/damage-comparison — run AI comparison on pickup vs return photos
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()

  if (!body?.pickupPhotoUrl || !body?.returnPhotoUrl) {
    throw new HttpError('VALIDATION_ERROR', 'pickupPhotoUrl and returnPhotoUrl are required.', 422)
  }

  const booking = await db.booking.findUnique({ where: { id }, select: { id: true, ownerId: true, status: true } })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (session.role !== 'admin' && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Only the owner or admin can run damage comparison.', 403)
  }

  const angle = body.angle || 'front'
  const provider = getVisionProvider()
  const result = await provider.compare(body.pickupPhotoUrl, body.returnPhotoUrl, angle)

  const comparison = await db.damageComparison.create({
    data: {
      bookingId: id,
      pickupPhotoUrl: body.pickupPhotoUrl,
      returnPhotoUrl: body.returnPhotoUrl,
      angle,
      findings: result.findings as never,
      providerUsed: result.providerUsed,
      promptLog: result.promptLog,
      status: 'pending',
    },
  })

  await audit({ action: 'AI_DAMAGE_COMPARISON', resource: 'booking', resourceId: id, actorId: session.id, metadata: { comparisonId: comparison.id, provider: result.providerUsed, findings: result.findings.length } })

  return ok({ ...comparison, summary: result.summary, disclaimer: 'Preliminary, requires human confirmation' }, 201)
})

// GET /api/v1/bookings/[id]/damage-comparison — list comparisons for a booking
export const GET = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)

  const booking = await db.booking.findUnique({ where: { id }, select: { customerId: true, ownerId: true } })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (session.role !== 'admin' && booking.customerId !== session.id && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  const comparisons = await db.damageComparison.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: 'desc' },
  })

  return ok(comparisons.map(c => ({ ...c, disclaimer: 'Preliminary, requires human confirmation' })))
})
