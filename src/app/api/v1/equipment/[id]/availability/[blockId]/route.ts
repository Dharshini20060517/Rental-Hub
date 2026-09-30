import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// DELETE /api/v1/equipment/[id]/availability/[blockId]
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, blockId } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const block = await db.availabilityBlock.findUnique({ where: { id: blockId } })
  if (!block || block.equipmentId !== id) throw new HttpError('NOT_FOUND', 'Block not found.', 404)

  await db.availabilityBlock.delete({ where: { id: blockId } })
  await audit({ action: 'AVAILABILITY_UNBLOCKED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok({ success: true })
})
