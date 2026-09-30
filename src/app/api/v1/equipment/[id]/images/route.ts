import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { parseAndSaveImages, deleteUpload } from '@/lib/upload'

// POST /api/v1/equipment/[id]/images — owner uploads images (multipart)
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true, deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const uploaded = await parseAndSaveImages(req, 'images', 8)
  const existing = await db.equipmentImage.count({ where: { equipmentId: id } })
  const hasPrimary = (await db.equipmentImage.findFirst({ where: { equipmentId: id, isPrimary: true } })) !== null

  const created = await db.$transaction(
    uploaded.map((u, i) =>
      db.equipmentImage.create({
        data: {
          equipmentId: id,
          url: u.url,
          publicId: u.publicId,
          order: existing + i,
          isPrimary: !hasPrimary && i === 0,
        },
      }),
    ),
  )

  await audit({ action: 'LISTING_IMAGES_ADDED', resource: 'equipment', resourceId: id, actorId: session.id, metadata: { count: created.length } })
  return ok(created, 201)
})

// PATCH /api/v1/equipment/[id]/images (body: { imageId, isPrimary }) — set primary
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const body = await req.json()
  const { imageId, isPrimary, order } = body as { imageId: string; isPrimary?: boolean; order?: number }
  if (!imageId) throw new HttpError('VALIDATION_ERROR', 'imageId required.', 422)

  if (isPrimary) {
    await db.equipmentImage.updateMany({ where: { equipmentId: id }, data: { isPrimary: false } })
  }
  const updated = await db.equipmentImage.update({
    where: { id: imageId },
    data: { isPrimary, order },
  })
  await audit({ action: 'LISTING_IMAGE_UPDATED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok(updated)
})
