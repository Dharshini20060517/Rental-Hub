import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/gdpr/export — export all user data (GDPR-style)
export const GET = apiHandler(async () => {
  const session = await requireAuth(['customer', 'owner', 'admin'])

  const [user, bookings, wishlists, reviews, notifications, auditLogs, waitlist, disputes] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, role: true, accountType: true, businessName: true, avatarUrl: true, phone: true, bio: true, isVerified: true, trustScore: true, createdAt: true },
    }),
    db.booking.findMany({ where: { OR: [{ customerId: session.id }, { ownerId: session.id }] }, include: { equipment: { select: { title: true } } } }),
    db.wishlist.findMany({ where: { userId: session.id }, include: { equipment: { select: { title: true } } } }),
    db.review.findMany({ where: { OR: [{ reviewerId: session.id }, { receiverId: session.id }] } }),
    db.notification.findMany({ where: { userId: session.id } }),
    db.auditLog.findMany({ where: { OR: [{ actorId: session.id }, { targetId: session.id }] } }),
    db.waitlist.findMany({ where: { userId: session.id }, include: { equipment: { select: { title: true } } } }),
    db.dispute.findMany({ where: { OR: [{ raisedById: session.id }, { againstId: session.id }] } }),
  ])

  if (!user) throw new HttpError('NOT_FOUND', 'User not found.', 404)

  return ok({
    exportedAt: new Date().toISOString(),
    user,
    bookings,
    wishlists,
    reviews,
    notifications,
    auditLogs,
    waitlist,
    disputes,
  })
})
