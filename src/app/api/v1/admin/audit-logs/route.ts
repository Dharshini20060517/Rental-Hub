import { apiHandler } from '@/lib/handler'
import { ok, paged } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

// GET /api/v1/admin/audit-logs
export const GET = apiHandler(async (req) => {
  await requireAuth(['admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 25)))
  const action = sp.get('action') || undefined
  const resource = sp.get('resource') || undefined
  const actorId = sp.get('actorId') || undefined

  const where: Record<string, unknown> = {}
  if (action) where.action = { contains: action }
  if (resource) where.resource = resource
  if (actorId) where.actorId = actorId

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where: where as never }),
    db.auditLog.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return paged(rows, page, limit, total)
})
