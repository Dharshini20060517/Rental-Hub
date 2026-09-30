import { apiHandler } from '@/lib/handler'
import { ok, failFromZod } from '@/lib/api'
import { z } from 'zod'
import { checkAvailability } from '@/lib/booking-service'

const schema = z.object({
  equipmentId: z.string().cuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

// POST /api/v1/bookings/check-availability — check if a date range is available
export const POST = apiHandler(async (req) => {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const result = await checkAvailability(
    parsed.data.equipmentId,
    new Date(parsed.data.startDate),
    new Date(parsed.data.endDate),
  )

  return ok(result)
})
