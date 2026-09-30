import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { maintenanceLogSchema } from '@/lib/validators'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// GET /api/v1/equipment/[id]/maintenance
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { deletedAt: true, ownerId: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  const logs = await db.maintenanceLog.findMany({
    where: { equipmentId: id },
    orderBy: { performedAt: 'desc' },
  })
  return ok(logs)
})

// POST /api/v1/equipment/[id]/maintenance — owner logs maintenance
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const body = await req.json()
  const parsed = maintenanceLogSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const log = await db.maintenanceLog.create({
    data: {
      equipmentId: id,
      ownerId: session.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      cost: parsed.data.cost,
      performedAt: parsed.data.performedAt ? new Date(parsed.data.performedAt) : new Date(),
    },
  })
  await audit({ action: 'MAINTENANCE_LOGGED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok(log, 201)
})
