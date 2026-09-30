import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/analytics/patterns — booking patterns by weekday, hour, duration, cancellation rate
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const bookingWhere: Record<string, unknown> = {}
  if (session.role === 'owner') bookingWhere.ownerId = session.id

  const bookings = await db.booking.findMany({
    where: bookingWhere as never,
    select: { startDate: true, endDate: true, status: true, days: true, cancelReason: true, createdAt: true },
  })

  // By weekday (0=Sun ... 6=Sat)
  const weekdayCount = [0, 0, 0, 0, 0, 0, 0]
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // By hour (pickup time proxy — using createdAt)
  const hourCount = Array.from({ length: 24 }, () => 0)

  let totalDuration = 0
  let cancelledCount = 0
  let completedCount = 0
  const cancelReasons: Record<string, number> = {}

  for (const b of bookings) {
    const dow = b.startDate.getDay()
    weekdayCount[dow]++
    const hour = b.createdAt.getHours()
    hourCount[hour]++
    totalDuration += b.days || 1
    if (b.status === 'cancelled') {
      cancelledCount++
      if (b.cancelReason) cancelReasons[b.cancelReason] = (cancelReasons[b.cancelReason] || 0) + 1
    }
    if (b.status === 'completed') completedCount++
  }

  const total = bookings.length
  const avgDuration = total > 0 ? Math.round((totalDuration / total) * 10) / 10 : 0
  const cancellationRate = total > 0 ? Math.round((cancelledCount / total) * 100) : 0

  // Repeat customer rate
  const customerCounts: Record<string, number> = {}
  const custBookings = await db.booking.findMany({ where: bookingWhere as never, select: { customerId: true } })
  for (const b of custBookings) {
    customerCounts[b.customerId] = (customerCounts[b.customerId] || 0) + 1
  }
  const repeatCustomers = Object.values(customerCounts).filter(c => c > 1).length
  const totalCustomers = Object.keys(customerCounts).length
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0

  return ok({
    weekday: weekdayLabels.map((label, i) => ({ label, bookings: weekdayCount[i] })),
    hourly: hourCount.map((count, hour) => ({ hour, bookings: count })),
    avgDuration,
    cancellationRate,
    cancelReasons: Object.entries(cancelReasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    completedCount,
    cancelledCount,
    repeatRate,
    repeatCustomers,
    totalCustomers,
    totalBookings: total,
  })
})
