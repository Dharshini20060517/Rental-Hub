import { apiHandler, getParams } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

// POST /api/v1/bookings/[id]/inspect — owner inspects returned equipment
// body: { pass: boolean }
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json().catch(() => ({}))
  const pass = body?.pass !== false // default true
  const result = await BookingService.inspect(id, session.id, pass)
  return ok(result)
})
