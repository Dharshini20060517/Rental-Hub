import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/bookings/[id] — get a single booking with full details
export const GET = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      equipment: { include: { images: true, specs: true, category: true } },
      customer: { select: { id: true, name: true, avatarUrl: true, isVerified: true, email: true } },
      owner: { select: { id: true, name: true, businessName: true, avatarUrl: true, isVerified: true } },
      payments: { orderBy: { createdAt: 'desc' } },
      messages: { include: { sender: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
      disputes: { include: { messages: { include: { sender: { select: { id: true, name: true } } } } } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)

  // Access control: customer, owner of the equipment, or admin
  if (session.role !== 'admin' && booking.customerId !== session.id && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'You do not have access to this booking.', 403)
  }

  return ok(booking)
})
