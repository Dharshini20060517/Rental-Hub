import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { categorySchema } from '@/lib/validators'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const cat = await db.category.findUnique({ where: { id } })
  if (!cat || cat.deletedAt) throw new HttpError('NOT_FOUND', 'Category not found.', 404)
  return ok(cat)
})

export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = categorySchema.partial().safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const cat = await db.category.findUnique({ where: { id } })
  if (!cat || cat.deletedAt) throw new HttpError('NOT_FOUND', 'Category not found.', 404)

  if (parsed.data.slug && parsed.data.slug !== cat.slug) {
    const clash = await db.category.findUnique({ where: { slug: parsed.data.slug } })
    if (clash) throw new HttpError('CONFLICT', 'Category slug already exists.', 409)
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      iconUrl: parsed.data.iconUrl,
      parentId: parsed.data.parentId,
    },
  })
  await audit({ action: 'CATEGORY_UPDATED', resource: 'category', resourceId: id, actorId: session.id })
  return ok(updated)
})

export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['admin'])
  const { id } = await getParams(ctx)
  const cat = await db.category.findUnique({ where: { id } })
  if (!cat || cat.deletedAt) throw new HttpError('NOT_FOUND', 'Category not found.', 404)

  const inUse = await db.equipment.count({ where: { categoryId: id, deletedAt: null } })
  if (inUse > 0) throw new HttpError('CONFLICT', `Category in use by ${inUse} listings.`, 409)

  await db.category.update({ where: { id }, data: { deletedAt: new Date() } })
  await audit({ action: 'CATEGORY_DELETED', resource: 'category', resourceId: id, actorId: session.id })
  return ok({ success: true })
})
