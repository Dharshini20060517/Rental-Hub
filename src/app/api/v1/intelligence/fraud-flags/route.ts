import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/intelligence/fraud-flags — rule-based fraud/anomaly detection for admins
export const GET = apiHandler(async () => {
  await requireAuth(['admin'])

  const flags: { type: string; severity: 'high' | 'medium' | 'low'; description: string; userId?: string; bookingId?: string }[] = []

  // 1. Multiple failed payments
  const failedPayments = await db.payment.groupBy({
    by: ['userId'],
    where: { status: 'failed' },
    _count: true,
  })
  for (const f of failedPayments) {
    if (f._count >= 3) {
      flags.push({ type: 'multiple_failed_payments', severity: 'medium', description: `User has ${f._count} failed payment attempts`, userId: f.userId })
    }
  }

  // 2. Multiple cancelled bookings
  const cancelledBookings = await db.booking.groupBy({
    by: ['customerId'],
    where: { status: 'cancelled' },
    _count: true,
  })
  for (const c of cancelledBookings) {
    if (c._count >= 5) {
      flags.push({ type: 'frequent_cancellations', severity: 'medium', description: `Customer has cancelled ${c._count} bookings`, userId: c.customerId })
    }
  }

  // 3. Multiple disputes raised by same user
  const disputes = await db.dispute.groupBy({
    by: ['raisedById'],
    _count: true,
  })
  for (const d of disputes) {
    if (d._count >= 3) {
      flags.push({ type: 'frequent_disputes', severity: 'high', description: `User has raised ${d._count} disputes`, userId: d.raisedById })
    }
  }

  // 4. Suspiciously low trust score
  const users = await db.user.findMany({
    where: { trustScore: { lt: 30 }, deletedAt: null },
    select: { id: true, name: true, email: true, trustScore: true },
  })
  for (const u of users) {
    flags.push({ type: 'low_trust_score', severity: 'high', description: `User "${u.name}" has trust score ${u.trustScore}`, userId: u.id })
  }

  // 5. Bookings with very short duration (potential abuse)
  const shortBookings = await db.booking.findMany({
    where: { days: { lte: 0 }, status: { not: 'cancelled' } },
    select: { id: true, customerId: true },
  })
  for (const b of shortBookings) {
    flags.push({ type: 'invalid_booking_duration', severity: 'low', description: 'Booking with invalid duration detected', bookingId: b.id, userId: b.customerId })
  }

  return ok({ flags, totalFlags: flags.length })
})
