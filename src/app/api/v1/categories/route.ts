import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { categorySchema } from '@/lib/validators'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const includeDeleted = sp.get('includeDeleted') === 'true'
  const rows = await db.category.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { name: 'asc' },
  })
  return ok(rows)
})

export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['admin'])
  const body = await req.json()
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const exists = await db.category.findUnique({ where: { slug: parsed.data.slug } })
  if (exists) throw new HttpError('CONFLICT', 'Category slug already exists.', 409)

  const cat = await db.category.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      iconUrl: parsed.data.iconUrl ?? null,
      parentId: parsed.data.parentId ?? null,
    },
  })
  await audit({ action: 'CATEGORY_CREATED', resource: 'category', resourceId: cat.id, actorId: session.id })
  return ok(cat, 201)
})
