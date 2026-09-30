import { apiHandler, getParams } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

// POST /api/v1/bookings/[id]/complete — finalize booking, release deposit
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const result = await BookingService.complete(id, session.id)
  return ok(result)
})
