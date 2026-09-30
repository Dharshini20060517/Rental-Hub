import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/analytics/revenue?period=daily|weekly|monthly&months=12
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const months = Math.min(12, Math.max(1, Number(sp.get('months') || 6)))

  // For owners: their own revenue; for admin: platform-wide
  const bookingWhere: Record<string, unknown> = { status: 'completed' }
  if (session.role === 'owner') bookingWhere.ownerId = session.id

  const bookings = await db.booking.findMany({
    where: bookingWhere as never,
    select: { totalAmount: true, commissionAmount: true, depositAmount: true, createdAt: true, completedAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by month
  const now = new Date()
  const monthsData: { month: string; label: string; revenue: number; commission: number; bookings: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
    const label = monthStart.toLocaleDateString('en-IN', { month: 'short' })

    const monthBookings = bookings.filter(b => {
      const d = b.completedAt || b.createdAt
      return d >= monthStart && d <= monthEnd
    })

    const revenue = monthBookings.reduce((sum, b) => sum + b.totalAmount, 0)
    const commission = monthBookings.reduce((sum, b) => sum + b.commissionAmount, 0)

    monthsData.push({ month: monthStart.toISOString(), label, revenue: Math.round(revenue), commission: Math.round(commission), bookings: monthBookings.length })
  }

  const totalRevenue = monthsData.reduce((s, m) => s + m.revenue, 0)
  const totalBookings = monthsData.reduce((s, m) => s + m.bookings, 0)

  return ok({
    months: monthsData,
    totals: {
      revenue: totalRevenue,
      commission: monthsData.reduce((s, m) => s + m.commission, 0),
      bookings: totalBookings,
      avgPerBooking: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
    },
  })
})
