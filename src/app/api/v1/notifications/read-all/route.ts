import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// POST /api/v1/notifications/read-all — mark all as read for the current user
export const POST = apiHandler(async () => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const result = await db.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  })
  return ok({ updated: result.count })
})
