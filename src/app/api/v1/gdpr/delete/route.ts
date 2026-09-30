import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// DELETE /api/v1/gdpr/delete — soft-delete user account (GDPR-style)
export const DELETE = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])

  // Don't allow admin to delete their own account
  if (session.role === 'admin') throw new HttpError('FORBIDDEN', 'Admins cannot self-delete.', 403)

  // Soft-delete the user
  await db.user.update({
    where: { id: session.id },
    data: { deletedAt: new Date() },
  })

  // Remove wishlist entries
  await db.wishlist.deleteMany({ where: { userId: session.id } })

  // Remove waitlist entries
  await db.waitlist.deleteMany({ where: { userId: session.id } })

  // Mark notifications as read and anonymize
  await db.notification.updateMany({
    where: { userId: session.id },
    data: { isRead: true },
  })

  await audit({ action: 'GDPR_ACCOUNT_DELETED', resource: 'user', resourceId: session.id, actorId: session.id })

  return ok({ success: true, message: 'Account deleted. Your data has been anonymized.' })
})
