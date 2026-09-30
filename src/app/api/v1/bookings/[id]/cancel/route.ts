import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

const cancelSchema = z.object({ reason: z.string().min(1).max(500) })

// POST /api/v1/bookings/[id]/cancel
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const result = await BookingService.cancelBooking(id, session.id, parsed.data.reason)
  return ok(result)
})
