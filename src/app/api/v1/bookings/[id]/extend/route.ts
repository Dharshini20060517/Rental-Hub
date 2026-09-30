import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { BookingService } from '@/lib/booking-service'

const extendSchema = z.object({ newEndDate: z.string().datetime() })

// POST /api/v1/bookings/[id]/extend — request extension
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = extendSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const result = await BookingService.requestExtension(id, session.id, new Date(parsed.data.newEndDate))
  return ok(result)
})
