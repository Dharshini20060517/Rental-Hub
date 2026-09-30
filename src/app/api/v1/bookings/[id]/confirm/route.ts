import { apiHandler, getParams } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

// POST /api/v1/bookings/[id]/confirm — customer confirms booking (after payment)
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'admin'])
  const { id } = await getParams(ctx)
  const result = await BookingService.confirmBooking(id, session.id)
  return ok(result)
})
