import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/intelligence/trust-score?userId=<id>
// Returns trust score + breakdown of contributing factors
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const userId = sp.get('userId') || session.id

  // Only allow viewing own score or admin viewing any
  if (userId !== session.id && session.role !== 'admin') {
    throw new HttpError('FORBIDDEN', 'You can only view your own trust score.', 403)
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, trustScore: true, isVerified: true, createdAt: true },
  })
  if (!user) throw new HttpError('NOT_FOUND', 'User not found.', 404)

  // Compute trust factors
  const [completedBookings, cancelledBookings, lateBookings, disputes, reviewsReceived, avgRating] = await Promise.all([
    db.booking.count({ where: { customerId: userId, status: 'completed' } }),
    db.booking.count({ where: { customerId: userId, status: 'cancelled' } }),
    db.booking.count({ where: { customerId: userId, status: 'late' } }),
    db.dispute.count({ where: { raisedById: userId } }),
    db.review.count({ where: { receiverId: userId, status: 'published', deletedAt: null } }),
    db.review.aggregate({ where: { receiverId: userId, status: 'published', deletedAt: null }, _avg: { rating: true } }),
  ])

  const factors = [
    { label: 'Verification', value: user.isVerified ? 10 : 0, max: 10, note: user.isVerified ? 'Verified account' : 'Not verified' },
    { label: 'Completed rentals', value: Math.min(25, completedBookings * 5), max: 25, note: `${completedBookings} completed` },
    { label: 'Cancellation rate', value: Math.max(0, 15 - cancelledBookings * 3), max: 15, note: `${cancelledBookings} cancellations` },
    { label: 'Punctuality', value: Math.max(0, 20 - lateBookings * 5), max: 20, note: lateBookings === 0 ? 'No late returns' : `${lateBookings} late returns` },
    { label: 'Disputes', value: Math.max(0, 10 - disputes * 5), max: 10, note: disputes === 0 ? 'No disputes' : `${disputes} disputes raised` },
    { label: 'Reviews received', value: Math.min(10, reviewsReceived * 2), max: 10, note: `${reviewsReceived} reviews` },
    { label: 'Avg rating', value: avgRating._avg.rating ? Math.round((avgRating._avg.rating / 5) * 10) : 5, max: 10, note: avgRating._avg.rating ? `${avgRating._avg.rating.toFixed(1)}★ avg` : 'No ratings' },
  ]

  const computedScore = factors.reduce((sum, f) => sum + f.value, 0)

  return ok({
    userId: user.id,
    userName: user.name,
    role: user.role,
    trustScore: user.trustScore ?? computedScore,
    computedScore,
    isVerified: user.isVerified,
    factors,
    memberSince: user.createdAt,
  })
})
