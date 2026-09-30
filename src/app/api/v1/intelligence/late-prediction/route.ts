import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/intelligence/late-prediction
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const activeBookings = await db.booking.findMany({
    where: {
      status: { in: ['confirmed', 'picked_up', 'in_use', 'return_pending'] },
      ...(session.role === 'owner' ? { ownerId: session.id } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, trustScore: true } },
      equipment: { select: { title: true } },
    },
  })

  const predictions = activeBookings.map((b) => {
    const hoursRemaining = (b.endDate.getTime() - Date.now()) / (1000 * 60 * 60)
    const trustScore = b.customer.trustScore ?? 50
    const trustRisk = Math.max(0, (50 - trustScore) / 50)
    const timeRisk = hoursRemaining < 24 ? Math.max(0, 1 - hoursRemaining / 24) : 0
    const overallRisk = Math.round((trustRisk * 0.4 + timeRisk * 0.6) * 100)

    let prediction: 'on_track' | 'at_risk' | 'likely_late'
    let recommendation: string

    if (hoursRemaining < 0) { prediction = 'likely_late'; recommendation = 'Booking is past due. Send an urgent reminder.' }
    else if (overallRisk > 60) { prediction = 'at_risk'; recommendation = 'High risk of late return. Consider sending a reminder now.' }
    else if (overallRisk > 30 && hoursRemaining < 48) { prediction = 'at_risk'; recommendation = 'Send a gentle reminder before the return deadline.' }
    else { prediction = 'on_track'; recommendation = 'No action needed.' }

    return {
      bookingId: b.id, equipmentTitle: b.equipment.title, customerName: b.customer.name,
      trustScore, hoursRemaining: Math.round(hoursRemaining), riskScore: overallRisk,
      prediction, recommendation, endDate: b.endDate,
    }
  }).sort((a, b) => b.riskScore - a.riskScore)

  return ok({ predictions, atRiskCount: predictions.filter(p => p.prediction === 'at_risk').length, likelyLateCount: predictions.filter(p => p.prediction === 'likely_late').length })
})
