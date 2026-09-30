import { apiHandler, getParams } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

// POST /api/v1/bookings/[id]/pickup — mark equipment as picked up
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json().catch(() => ({}))
  const result = await BookingService.pickup(id, session.id, body?.checklist, body?.photos)
  return ok(result)
})
