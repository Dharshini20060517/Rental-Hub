import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { equipmentInclude } from '@/lib/serializers'

// PATCH /api/v1/admin/equipment/[id]/moderate — body { action: 'approve'|'reject', notes? }
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const action = body?.action
  const notes = body?.notes as string | undefined

  if (!['approve', 'reject'].includes(action)) {
    throw new HttpError('VALIDATION_ERROR', "action must be 'approve' or 'reject'.", 422)
  }

  const item = await db.equipment.findUnique({ where: { id }, select: { deletedAt: true, status: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  const newStatus = action === 'approve' ? 'active' : 'rejected'
  const updated = await db.equipment.update({
    where: { id },
    data: { status: newStatus, moderatedAt: new Date(), moderatedById: session.id },
    include: equipmentInclude,
  })
  await audit({
    action: action === 'approve' ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
    resource: 'equipment',
    resourceId: id,
    actorId: session.id,
    metadata: { notes, previousStatus: item.status, newStatus },
  })
  return ok(updated)
})
