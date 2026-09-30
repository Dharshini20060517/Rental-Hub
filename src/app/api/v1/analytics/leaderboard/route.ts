import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/analytics/leaderboard — top owners by revenue + ROI per asset
export const GET = apiHandler(async () => {
  await requireAuth(['admin'])

  const completedBookings = await db.booking.findMany({
    where: { status: 'completed' },
    select: { ownerId: true, totalAmount: true, commissionAmount: true, equipmentId: true },
  })

  // Owner leaderboard
  const ownerMap = new Map<string, { revenue: number; bookings: number; commission: number }>()
  for (const b of completedBookings) {
    const existing = ownerMap.get(b.ownerId) || { revenue: 0, bookings: 0, commission: 0 }
    existing.revenue += b.totalAmount
    existing.commission += b.commissionAmount
    existing.bookings++
    ownerMap.set(b.ownerId, existing)
  }

  const owners = await db.user.findMany({
    where: { id: { in: Array.from(ownerMap.keys()) } },
    select: { id: true, name: true, businessName: true, avatarUrl: true, isVerified: true },
  })

  const leaderboard = owners.map((o) => ({
    ...o,
    ...(ownerMap.get(o.id) || { revenue: 0, bookings: 0, commission: 0 }),
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // ROI per asset
  const equipmentROI = await db.equipment.findMany({
    where: { deletedAt: null },
    select: {
      id: true, title: true, baseDailyPrice: true, replacementValue: true, createdAt: true,
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      _count: { select: { bookings: true } },
    },
  })

  const roiData = equipmentROI.map((eq) => {
    const eqBookings = completedBookings.filter(b => b.equipmentId === eq.id)
    const revenue = eqBookings.reduce((s, b) => s + b.totalAmount, 0)
    const replacement = eq.replacementValue || eq.baseDailyPrice * 30
    const roi = replacement > 0 ? Math.round((revenue / replacement) * 100) : 0
    const monthsSinceListed = Math.max(1, Math.round((Date.now() - eq.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    return {
      id: eq.id,
      title: eq.title,
      baseDailyPrice: eq.baseDailyPrice,
      replacementValue: eq.replacementValue,
      coverUrl: eq.images[0]?.url ?? null,
      bookingCount: eq._count.bookings,
      revenue,
      roi,
      monthlyRevenue: Math.round(revenue / monthsSinceListed),
      paybackMonths: revenue > 0 ? Math.round(replacement / (revenue / monthsSinceListed)) : null,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  return ok({ leaderboard, roiData })
})
