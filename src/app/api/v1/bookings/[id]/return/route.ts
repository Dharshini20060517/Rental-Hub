import { apiHandler, getParams } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

// POST /api/v1/bookings/[id]/return — initiate return (customer) or confirm return (owner)
// body: { action: 'initiate' | 'confirm', checklist?, photos? }
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json().catch(() => ({}))
  const action = body?.action || 'initiate'

  if (action === 'initiate') {
    const result = await BookingService.initiateReturn(id, session.id)
    return ok(result)
  } else {
    const result = await BookingService.confirmReturn(id, session.id, body?.checklist, body?.photos)
    return ok(result)
  }
})
