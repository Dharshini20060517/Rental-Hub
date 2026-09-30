import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// DELETE /api/v1/equipment/[id]/maintenance-windows/[windowId]
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, windowId } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const win = await db.maintenanceWindow.findUnique({ where: { id: windowId } })
  if (!win || win.equipmentId !== id) throw new HttpError('NOT_FOUND', 'Window not found.', 404)

  await db.$transaction([
    db.maintenanceWindow.delete({ where: { id: windowId } }),
    db.availabilityBlock.deleteMany({
      where: { equipmentId: id, reason: 'maintenance', startDate: win.startDate, endDate: win.endDate },
    }),
  ])
  await audit({ action: 'MAINTENANCE_WINDOW_DELETED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok({ success: true })
})
