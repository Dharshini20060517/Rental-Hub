import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { equipmentSchema } from '@/lib/validators'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { equipmentInclude } from '@/lib/serializers'
import { haversineKm } from '@/lib/geo'
import { Prisma } from '@prisma/client'

export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const lat = req.nextUrl?.searchParams?.get('lat')
  const lng = req.nextUrl?.searchParams?.get('lng')
  const userLat = lat ? Number(lat) : undefined
  const userLng = lng ? Number(lng) : undefined

  const item = await db.equipment.findUnique({ where: { id }, include: equipmentInclude })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  // rating aggregates
  const agg = await db.review.aggregate({
    where: { equipmentId: id, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const wishCount = await db.wishlist.count({ where: { equipmentId: id } })

  const data = {
    ...item,
    rating: agg._avg.rating ?? 0,
    reviewCount: agg._count,
    wishlistCount: wishCount,
    distance:
      userLat !== undefined && userLng !== undefined && item.lat !== null && item.lng !== null
        ? haversineKm({ lat: userLat, lng: userLng }, { lat: item.lat, lng: item.lng })
        : undefined,
  }
  return ok(data)
})

export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true, deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const body = await req.json()
  const parsed = equipmentSchema.partial().safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const data = parsed.data

  if (data.categoryId) {
    const cat = await db.category.findUnique({ where: { id: data.categoryId } })
    if (!cat || cat.deletedAt) throw new HttpError('NOT_FOUND', 'Category not found.', 404)
  }

  // Specs: replace if provided
  const updateData: Prisma.EquipmentUpdateInput = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.categoryId !== undefined) updateData.category = { connect: { id: data.categoryId } }
  if (data.status !== undefined) updateData.status = data.status
  if (data.condition !== undefined) updateData.condition = data.condition
  if (data.baseDailyPrice !== undefined) updateData.baseDailyPrice = data.baseDailyPrice
  if (data.baseHourlyPrice !== undefined) updateData.baseHourlyPrice = data.baseHourlyPrice
  if (data.baseDeposit !== undefined) updateData.baseDeposit = data.baseDeposit
  if (data.replacementValue !== undefined) updateData.replacementValue = data.replacementValue
  if (data.pricingRules !== undefined) updateData.pricingRules = data.pricingRules as unknown as Prisma.InputJsonValue
  if (data.lat !== undefined) updateData.lat = data.lat
  if (data.lng !== undefined) updateData.lng = data.lng
  if (data.city !== undefined) updateData.city = data.city
  if (data.address !== undefined) updateData.address = data.address
  if (data.bufferHours !== undefined) updateData.bufferHours = data.bufferHours
  if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null
  if (data.conditionNotes !== undefined) updateData.conditionNotes = data.conditionNotes

  const updated = await db.equipment.update({ where: { id }, data: updateData, include: equipmentInclude })

  if (data.specs !== undefined) {
    await db.equipmentSpec.deleteMany({ where: { equipmentId: id } })
    if (data.specs.length > 0) {
      await db.equipmentSpec.createMany({
        data: data.specs.map((s, i) => ({ equipmentId: id, key: s.key, value: s.value, order: i })),
      })
    }
  }

  await audit({ action: 'LISTING_UPDATED', resource: 'equipment', resourceId: id, actorId: session.id })
  const refreshed = await db.equipment.findUnique({ where: { id }, include: equipmentInclude })
  return ok(refreshed)
})

export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true, deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  await db.equipment.update({ where: { id }, data: { deletedAt: new Date() } })
  await audit({ action: 'LISTING_DELETED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok({ success: true })
})
