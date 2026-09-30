import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/equipment/[id]/condition-passport — public read-only QR page data
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)

  const equipment = await db.equipment.findUnique({
    where: { id },
    include: {
      ...equipmentInclude,
      maintenanceLogs: { orderBy: { performedAt: 'desc' }, take: 10 },
    },
  })

  if (!equipment || equipment.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

  // Count bookings
  const bookingCount = await db.booking.count({ where: { equipmentId: id, status: 'completed' } })

  // Get review stats
  const reviewAgg = await db.review.aggregate({
    where: { equipmentId: id, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })

  return ok({
    id: equipment.id,
    title: equipment.title,
    description: equipment.description,
    condition: equipment.condition,
    conditionNotes: equipment.conditionNotes,
    category: equipment.category,
    owner: { name: equipment.owner.businessName || equipment.owner.name, isVerified: equipment.owner.isVerified },
    baseDailyPrice: equipment.baseDailyPrice,
    images: equipment.images,
    specs: equipment.specs,
    rating: reviewAgg._avg.rating ?? 0,
    reviewCount: reviewAgg._count,
    completedBookings: bookingCount,
    maintenanceHistory: equipment.maintenanceLogs.map(m => ({ title: m.title, cost: m.cost, performedAt: m.performedAt })),
    passportGeneratedAt: new Date().toISOString(),
  })
})
