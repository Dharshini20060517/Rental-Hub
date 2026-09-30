import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// PATCH /api/v1/notifications/[id]/read — mark a single notification as read
export const PATCH = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)

  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif || notif.userId !== session.id) {
    throw new HttpError('NOT_FOUND', 'Notification not found.', 404)
  }

  const updated = await db.notification.update({ where: { id }, data: { isRead: true } })
  return ok(updated)
})
