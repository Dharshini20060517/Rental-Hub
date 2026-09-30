import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// DELETE /api/v1/waitlist/[id] — leave waitlist
export const DELETE = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'admin'])
  const { id } = await getParams(ctx)

  const entry = await db.waitlist.findUnique({ where: { id } })
  if (!entry) throw new HttpError('NOT_FOUND', 'Waitlist entry not found.', 404)
  if (entry.userId !== session.id && session.role !== 'admin') {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  await db.waitlist.delete({ where: { id } })
  return ok({ success: true })
})
