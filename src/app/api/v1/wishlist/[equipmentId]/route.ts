import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// POST /api/v1/wishlist/[equipmentId] — toggle in wishlist (add if absent, remove if present)
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { equipmentId } = await getParams(ctx)
  const eq = await db.equipment.findUnique({ where: { id: equipmentId }, select: { deletedAt: true } })
  if (!eq || eq.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  const existing = await db.wishlist.findUnique({
    where: { userId_equipmentId: { userId: session.id, equipmentId } },
  })
  if (existing) {
    await db.wishlist.delete({ where: { id: existing.id } })
    return ok({ inWishlist: false })
  }
  await db.wishlist.create({ data: { userId: session.id, equipmentId } })
  return ok({ inWishlist: true })
})

// DELETE /api/v1/wishlist/[equipmentId]
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { equipmentId } = await getParams(ctx)
  await db.wishlist.deleteMany({ where: { userId: session.id, equipmentId } })
  return ok({ inWishlist: false })
})

// GET /api/v1/wishlist/[equipmentId] — is it in my wishlist?
export const GET = apiHandler(async (req, ctx) => {
  const { equipmentId } = await getParams(ctx)
  const session = await requireAuth(['customer', 'owner', 'admin']).catch(() => null)
  if (!session) return ok({ inWishlist: false })
  const existing = await db.wishlist.findUnique({
    where: { userId_equipmentId: { userId: session.id, equipmentId } },
  })
  return ok({ inWishlist: !!existing })
})
