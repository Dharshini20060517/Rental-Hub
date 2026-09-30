import { apiHandler, getParams } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/disputes/[id] — get dispute with full history
export const GET = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)

  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          equipment: { select: { id: true, title: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
          customer: { select: { id: true, name: true, avatarUrl: true } },
          owner: { select: { id: true, name: true, businessName: true, avatarUrl: true } },
        },
      },
      raisedBy: { select: { id: true, name: true, avatarUrl: true } },
      against: { select: { id: true, name: true, avatarUrl: true } },
      messages: { include: { sender: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })

  if (!dispute) throw new HttpError('NOT_FOUND', 'Dispute not found.', 404)
  if (session.role !== 'admin' && dispute.raisedById !== session.id && dispute.againstId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  return ok(dispute)
})
