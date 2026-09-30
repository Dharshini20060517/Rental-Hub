import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

const approveSchema = z.object({ approve: z.boolean() })

// POST /api/v1/bookings/[id]/approve — owner approves/rejects a booking request
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = approveSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const result = await BookingService.ownerApprove(id, session.id, parsed.data.approve)
  return ok(result)
})
