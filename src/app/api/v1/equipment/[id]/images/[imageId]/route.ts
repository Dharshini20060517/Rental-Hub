import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { deleteUpload } from '@/lib/upload'

// DELETE /api/v1/equipment/[id]/images/[imageId] — remove image + file
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id, imageId } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const img = await db.equipmentImage.findUnique({ where: { id: imageId } })
  if (!img || img.equipmentId !== id) throw new HttpError('NOT_FOUND', 'Image not found.', 404)

  const wasPrimary = img.isPrimary
  await db.equipmentImage.delete({ where: { id: imageId } })
  if (img.publicId) await deleteUpload(img.publicId)

  // promote a new primary if needed
  if (wasPrimary) {
    const next = await db.equipmentImage.findFirst({ where: { equipmentId: id }, orderBy: { order: 'asc' } })
    if (next) await db.equipmentImage.update({ where: { id: next.id }, data: { isPrimary: true } })
  }

  await audit({ action: 'LISTING_IMAGE_REMOVED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok({ success: true })
})
