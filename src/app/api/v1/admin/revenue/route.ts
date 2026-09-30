import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/admin/revenue — platform-wide revenue trend (last 6 months, projected) + top owners
export const GET = apiHandler(async () => {
  await requireAuth(['admin'])

  const allEquipment = await db.equipment.findMany({
    where: { deletedAt: null, status: 'active' },
    select: { baseDailyPrice: true, createdAt: true },
  })

  const now = new Date()
  const months: { month: string; revenue: number; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const label = d.toLocaleDateString('en-IN', { month: 'short' })
    let revenue = 0
    for (const eq of allEquipment) {
      const created = new Date(eq.createdAt)
      if (created <= monthEnd) {
        const monthsSince = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) - i)
        const utilization = Math.min(0.65, 0.15 + monthsSince * 0.08)
        revenue += eq.baseDailyPrice * 20 * utilization
      }
    }
    months.push({ month: d.toISOString(), revenue: Math.round(revenue), label })
  }

  const owners = await db.user.findMany({
    where: { role: 'owner', deletedAt: null },
    select: {
      id: true, name: true, businessName: true, avatarUrl: true, isVerified: true,
      equipment: { where: { deletedAt: null, status: 'active' }, select: { baseDailyPrice: true, createdAt: true } },
    },
  })

  const ownerRevenue = owners.map((o) => {
    let rev = 0
    for (const eq of o.equipment) {
      const created = new Date(eq.createdAt)
      const monthsSince = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()))
      const utilization = Math.min(0.65, 0.15 + monthsSince * 0.08)
      rev += eq.baseDailyPrice * 20 * utilization
    }
    return {
      id: o.id, name: o.businessName || o.name || 'Owner', avatarUrl: o.avatarUrl, isVerified: o.isVerified,
      listingCount: o.equipment.length, projectedRevenue: Math.round(rev),
    }
  }).sort((a, b) => b.projectedRevenue - a.projectedRevenue).slice(0, 5)

  return ok({
    months, topOwners: ownerRevenue,
    totalProjectedMonthly: months[months.length - 1]?.revenue || 0,
  })
})
