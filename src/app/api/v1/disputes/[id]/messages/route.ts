import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

const msgSchema = z.object({ message: z.string().min(1).max(2000) })

// POST /api/v1/disputes/[id]/messages — add a message to a dispute
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = msgSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const dispute = await db.dispute.findUnique({ where: { id }, select: { raisedById: true, againstId: true, status: true } })
  if (!dispute) throw new HttpError('NOT_FOUND', 'Dispute not found.', 404)
  if (dispute.status === 'resolved' || dispute.status === 'closed') {
    throw new HttpError('BAD_REQUEST', 'This dispute is already resolved.', 400)
  }
  if (session.role !== 'admin' && dispute.raisedById !== session.id && dispute.againstId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  const message = await db.disputeMessage.create({
    data: {
      disputeId: id,
      senderId: session.id,
      message: parsed.data.message,
      isStaff: session.role === 'admin',
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  })

  // Update dispute status when against party responds
  if (dispute.raisedById === session.id && dispute.status === 'open') {
    // raiser sending more evidence - no status change
  } else if (dispute.againstId === session.id && dispute.status === 'open') {
    await db.dispute.update({ where: { id }, data: { status: 'owner_responded' } })
  }

  return ok(message, 201)
})

// GET /api/v1/disputes/[id]/messages
export const GET = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const { id } = await getParams(ctx)
  const dispute = await db.dispute.findUnique({ where: { id }, select: { raisedById: true, againstId: true } })
  if (!dispute) throw new HttpError('NOT_FOUND', 'Dispute not found.', 404)
  if (session.role !== 'admin' && dispute.raisedById !== session.id && dispute.againstId !== session.id) {
    throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
  }

  const messages = await db.disputeMessage.findMany({
    where: { disputeId: id },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return ok(messages)
})
