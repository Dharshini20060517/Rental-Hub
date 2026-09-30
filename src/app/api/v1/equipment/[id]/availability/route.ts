import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { availabilityBlockSchema } from '@/lib/validators'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// GET /api/v1/equipment/[id]/availability
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  const blocks = await db.availabilityBlock.findMany({
    where: { equipmentId: id },
    orderBy: { startDate: 'asc' },
  })
  return ok(blocks)
})

// POST /api/v1/equipment/[id]/availability — owner blocks a date range
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const body = await req.json()
  const parsed = availabilityBlockSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const start = new Date(parsed.data.startDate)
  const end = new Date(parsed.data.endDate)
  if (end <= start) throw new HttpError('VALIDATION_ERROR', 'End date must be after start date.', 422)

  const block = await db.availabilityBlock.create({
    data: {
      equipmentId: id,
      ownerId: session.id,
      startDate: start,
      endDate: end,
      reason: parsed.data.reason,
    },
  })
  await audit({ action: 'AVAILABILITY_BLOCKED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok(block, 201)
})
