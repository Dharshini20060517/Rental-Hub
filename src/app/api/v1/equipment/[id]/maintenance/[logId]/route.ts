import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// PATCH /api/v1/equipment/[id]/maintenance/[logId]
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, logId } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const log = await db.maintenanceLog.findUnique({ where: { id: logId } })
  if (!log || log.equipmentId !== id) throw new HttpError('NOT_FOUND', 'Log not found.', 404)

  const body = await req.json()
  const updated = await db.maintenanceLog.update({
    where: { id: logId },
    data: {
      title: body.title,
      description: body.description,
      cost: typeof body.cost === 'number' ? body.cost : undefined,
    },
  })
  await audit({ action: 'MAINTENANCE_UPDATED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok(updated)
})

// DELETE /api/v1/equipment/[id]/maintenance/[logId]
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, logId } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const log = await db.maintenanceLog.findUnique({ where: { id: logId } })
  if (!log || log.equipmentId !== id) throw new HttpError('NOT_FOUND', 'Log not found.', 404)

  await db.maintenanceLog.delete({ where: { id: logId } })
  await audit({ action: 'MAINTENANCE_DELETED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok({ success: true })
})
