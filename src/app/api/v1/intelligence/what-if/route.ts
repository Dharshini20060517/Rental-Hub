import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { calculatePrice, type PricingRule } from '@/lib/pricing'

const whatIfSchema = z.object({
  equipmentId: z.string().cuid(),
  dailyPrice: z.number().min(0),
  availableDaysPerMonth: z.number().min(0).max(31),
})

// POST /api/v1/intelligence/what-if — simulate price/availability vs projected revenue
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['owner', 'admin'])
  const body = await req.json()
  const parsed = whatIfSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const equipment = await db.equipment.findUnique({
    where: { id: parsed.data.equipmentId },
    select: { ownerId: true, baseDailyPrice: true, baseDeposit: true, pricingRules: true, createdAt: true },
  })
  if (!equipment) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  if (session.role !== 'admin' && equipment.ownerId !== session.id) throw new HttpError('FORBIDDEN', 'Not your listing.', 403)

  const monthsSinceListed = Math.max(1, Math.round((Date.now() - equipment.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)))

  // Current projection (based on current price and estimated utilization)
  const currentUtilization = Math.min(0.65, 0.15 + monthsSinceListed * 0.05)
  const currentMonthlyRevenue = equipment.baseDailyPrice * 20 * currentUtilization

  // Simulated projection with new price and availability
  const newDailyPrice = parsed.data.dailyPrice
  const newAvailableDays = parsed.data.availableDaysPerMonth

  // Price elasticity: if price increases, demand decreases slightly
  const priceChangeRatio = equipment.baseDailyPrice > 0 ? newDailyPrice / equipment.baseDailyPrice : 1
  const demandMultiplier = priceChangeRatio > 1 ? Math.max(0.5, 1 - (priceChangeRatio - 1) * 0.3) : 1 + (1 - priceChangeRatio) * 0.2

  const newUtilization = Math.min(0.9, currentUtilization * demandMultiplier * (newAvailableDays / 20))
  const newMonthlyRevenue = newDailyPrice * newAvailableDays * newUtilization
  const revenueDiff = newMonthlyRevenue - currentMonthlyRevenue
  const revenueDiffPct = currentMonthlyRevenue > 0 ? Math.round((revenueDiff / currentMonthlyRevenue) * 100) : 0

  // Sample a 7-day booking at the new price to show breakdown
  const start = new Date()
  const end = new Date(start.getTime() + 7 * 86400000)
  const sampleBreakdown = calculatePrice(newDailyPrice, equipment.baseDeposit, start, end, (equipment.pricingRules as PricingRule[]) || [])

  return ok({
    current: {
      dailyPrice: equipment.baseDailyPrice,
      estimatedUtilization: Math.round(currentUtilization * 100) + '%',
      monthlyRevenue: Math.round(currentMonthlyRevenue),
      annualRevenue: Math.round(currentMonthlyRevenue * 12),
    },
    simulated: {
      dailyPrice: newDailyPrice,
      availableDaysPerMonth: newAvailableDays,
      estimatedUtilization: Math.round(newUtilization * 100) + '%',
      monthlyRevenue: Math.round(newMonthlyRevenue),
      annualRevenue: Math.round(newMonthlyRevenue * 12),
      sampleBookingTotal: sampleBreakdown.total,
    },
    comparison: {
      revenueDiff: Math.round(revenueDiff),
      revenueDiffPct: revenueDiffPct > 0 ? `+${revenueDiffPct}%` : `${revenueDiffPct}%`,
      demandMultiplier: Math.round(demandMultiplier * 100) / 100,
    },
  })
})
