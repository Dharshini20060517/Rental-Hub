import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { BookingService, calculateBookingPrice } from '@/lib/booking-service'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { equipmentInclude } from '@/lib/serializers'

const bookingSchema = z.object({
  equipmentId: z.string().cuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  idempotencyKey: z.string().optional(),
})

// POST /api/v1/bookings — create a booking (held with 10-min checkout hold)
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'admin'])
  const body = await req.json()
  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const result = await BookingService.createBooking({
    equipmentId: parsed.data.equipmentId,
    customerId: session.id,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    idempotencyKey: parsed.data.idempotencyKey,
  })

  await audit({ action: 'BOOKING_CREATED', resource: 'booking', resourceId: result.id, actorId: session.id })

  return ok(result, 201)
})

const listParamsSchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(48).default(12),
})

// GET /api/v1/bookings — list bookings (role-scoped)
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const parsed = listParamsSchema.safeParse(Object.fromEntries(sp.entries()))
  if (!parsed.success) return failFromZod(parsed.error)
  const { status, page, limit } = parsed.data

  const where: Prisma.BookingWhereInput = {}
  if (status) where.status = status

  // Role scoping
  if (session.role === 'customer') {
    where.customerId = session.id
  } else if (session.role === 'owner') {
    where.ownerId = session.id
  }
  // admin sees all

  const [total, rows] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: {
        equipment: { include: equipmentInclude },
        customer: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        owner: { select: { id: true, name: true, businessName: true, avatarUrl: true, isVerified: true } },
        payments: true,
        _count: { select: { messages: true, disputes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return ok(rows, 200, { page, limit, total, totalPages: Math.ceil(total / limit) || 0 })
})
