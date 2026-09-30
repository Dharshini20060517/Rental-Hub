import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/intelligence/damage-estimate?bookingId=<id>
// Estimates repair cost from confirmed AI findings + maintenance history
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const bookingId = sp.get('bookingId')

  if (!bookingId) throw new HttpError('VALIDATION_ERROR', 'bookingId required.', 422)

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, ownerId: true, equipmentId: true, depositAmount: true, totalAmount: true, status: true },
  })
  if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
  if (session.role !== 'admin' && booking.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  // Get confirmed damage findings
  const comparisons = await db.damageComparison.findMany({
    where: { bookingId, status: 'confirmed' },
  })

  const findings = comparisons.flatMap(c => {
    const f = c.findings as { region: string; severity: string; description: string; confidence: number }[] | null
    return (f || []).map(item => ({ ...item, comparisonId: c.id, angle: c.angle }))
  }).filter(f => f.severity !== 'none')

  // Estimate cost based on severity
  const SEVERITY_COSTS: Record<string, { min: number; max: number }> = {
    minor: { min: 200, max: 1000 },
    moderate: { min: 1000, max: 5000 },
    severe: { min: 5000, max: 20000 },
  }

  let estimatedCostMin = 0
  let estimatedCostMax = 0
  const costBreakdown = findings.map(f => {
    const costs = SEVERITY_COSTS[f.severity] || SEVERITY_COSTS.minor
    estimatedCostMin += costs.min
    estimatedCostMax += costs.max
    return { region: f.region, severity: f.severity, estimatedMin: costs.min, estimatedMax: costs.max, description: f.description }
  })

  // Get maintenance history for reference
  const maintenanceHistory = await db.maintenanceLog.findMany({
    where: { equipmentId: booking.equipmentId },
    select: { title: true, cost: true, performedAt: true },
    orderBy: { performedAt: 'desc' },
    take: 5,
  })

  // Suggested resolution
  let suggestedResolution: string
  if (estimatedCostMin === 0) {
    suggestedResolution = 'No confirmed damage found. Release full deposit.'
  } else if (estimatedCostMin <= booking.depositAmount) {
    suggestedResolution = `Estimated repair cost (₹${estimatedCostMin}-₹${estimatedCostMax}) is within deposit (₹${booking.depositAmount}). Deduct from deposit.`
  } else {
    suggestedResolution = `Estimated repair cost (₹${estimatedCostMin}-₹${estimatedCostMax}) exceeds deposit (₹${booking.depositAmount}). Escalate to dispute.`
  }

  return ok({
    bookingId,
    confirmedFindings: findings.length,
    costBreakdown,
    estimatedCostMin,
    estimatedCostMax,
    depositAmount: booking.depositAmount,
    depositSufficient: estimatedCostMin <= booking.depositAmount,
    suggestedResolution,
    maintenanceHistory,
  })
})
