import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { userAdminUpdateSchema } from '@/lib/validators'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { userSelect } from '@/lib/serializers'

// PATCH /api/v1/admin/users/[id] — verify/suspend/role
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = userAdminUpdateSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const target = await db.user.findUnique({ where: { id } })
  if (!target || target.deletedAt) throw new HttpError('NOT_FOUND', 'User not found.', 404)

  if (target.id === session.id && parsed.data.role && parsed.data.role !== 'admin') {
    throw new HttpError('BAD_REQUEST', 'You cannot demote yourself.', 400)
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      role: parsed.data.role,
      isVerified: parsed.data.isVerified,
      isSuspended: parsed.data.isSuspended,
    },
    select: userSelect,
  })
  await audit({
    action: 'USER_UPDATED_BY_ADMIN',
    resource: 'user',
    resourceId: id,
    actorId: session.id,
    targetId: id,
    metadata: parsed.data,
  })
  return ok(updated)
})
