import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/analytics/utilization — per-item utilization rate
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const bookingWhere: Record<string, unknown> = {}
  if (session.role === 'owner') bookingWhere.ownerId = session.id

  const allBookings = await db.booking.findMany({
    where: bookingWhere as never,
    select: { equipmentId: true, startDate: true, endDate: true, status: true },
  })

  const eqWhere: Record<string, unknown> = { deletedAt: null }
  if (session.role === 'owner') eqWhere.ownerId = session.id

  const equipment = await db.equipment.findMany({
    where: eqWhere as never,
    select: { id: true, title: true, baseDailyPrice: true, status: true, createdAt: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
  })

  const utilData = equipment.map((eq) => {
    const eqBookings = allBookings.filter(b => b.equipmentId === eq.id && b.status !== 'cancelled')
    const totalDaysRented = eqBookings.reduce((sum, b) => {
      return sum + Math.ceil((b.endDate.getTime() - b.startDate.getTime()) / (1000 * 60 * 60 * 24))
    }, 0)
    const daysSinceListed = Math.max(1, Math.ceil((Date.now() - eq.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
    const utilizationRate = Math.round((totalDaysRented / daysSinceListed) * 100)

    return {
      id: eq.id,
      title: eq.title,
      baseDailyPrice: eq.baseDailyPrice,
      status: eq.status,
      coverUrl: eq.images[0]?.url ?? null,
      bookingCount: eqBookings.length,
      totalDaysRented,
      utilizationRate: Math.min(100, utilizationRate),
      potentialRevenue: totalDaysRented * eq.baseDailyPrice,
    }
  }).sort((a, b) => b.utilizationRate - a.utilizationRate)

  return ok({
    items: utilData,
    avgUtilization: utilData.length > 0 ? Math.round(utilData.reduce((s, u) => s + u.utilizationRate, 0) / utilData.length) : 0,
  })
})
