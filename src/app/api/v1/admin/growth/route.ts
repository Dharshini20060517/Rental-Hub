import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/admin/growth — user & equipment registration growth (last 6 months)
export const GET = apiHandler(async () => {
  await requireAuth(['admin'])

  const now = new Date()
  const months: { label: string; users: number; equipment: number; owners: number }[] = []

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
    const label = monthStart.toLocaleDateString('en-IN', { month: 'short' })

    const [users, equipment, owners] = await Promise.all([
      db.user.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, deletedAt: null },
      }),
      db.equipment.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, deletedAt: null },
      }),
      db.user.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, role: 'owner', deletedAt: null },
      }),
    ])

    months.push({ label, users, equipment, owners })
  }

  // Cumulative totals
  const totalUsers = await db.user.count({ where: { deletedAt: null } })
  const totalEquipment = await db.equipment.count({ where: { deletedAt: null } })
  const totalOwners = await db.user.count({ where: { role: 'owner', deletedAt: null } })

  // Growth rate (this month vs last month)
  const thisMonth = months[months.length - 1]
  const lastMonth = months[months.length - 2]
  const userGrowthRate = lastMonth && lastMonth.users > 0
    ? Math.round(((thisMonth.users - lastMonth.users) / lastMonth.users) * 100)
    : 0
  const equipmentGrowthRate = lastMonth && lastMonth.equipment > 0
    ? Math.round(((thisMonth.equipment - lastMonth.equipment) / lastMonth.equipment) * 100)
    : 0

  return ok({
    months,
    totals: { users: totalUsers, equipment: totalEquipment, owners: totalOwners },
    growthRates: { users: userGrowthRate, equipment: equipmentGrowthRate },
  })
})
