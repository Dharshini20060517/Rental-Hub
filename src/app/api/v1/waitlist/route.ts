import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

const waitlistSchema = z.object({
  equipmentId: z.string().cuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

// POST /api/v1/waitlist — join waitlist for unavailable dates
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'admin'])
  const body = await req.json()
  const parsed = waitlistSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  // Check if already on waitlist
  const existing = await db.waitlist.findFirst({
    where: { equipmentId: parsed.data.equipmentId, userId: session.id, status: 'waiting' },
  })
  if (existing) throw new HttpError('CONFLICT', 'Already on waitlist for this equipment.', 409)

  const entry = await db.waitlist.create({
    data: {
      equipmentId: parsed.data.equipmentId,
      userId: session.id,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  })

  await audit({ action: 'WAITLIST_JOINED', resource: 'waitlist', resourceId: entry.id, actorId: session.id })
  return ok(entry, 201)
})

// GET /api/v1/waitlist — list user's waitlist entries
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])

  let where: Record<string, unknown> = {}
  if (session.role === 'customer') where.userId = session.id
  else if (session.role === 'owner') {
    // Owners see waitlist for their equipment
    const myEq = await db.equipment.findMany({ where: { ownerId: session.id, deletedAt: null }, select: { id: true } })
    where.equipmentId = { in: myEq.map(e => e.id) }
  }

  const entries = await db.waitlist.findMany({
    where: where as never,
    include: {
      equipment: { select: { id: true, title: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(entries)
})
