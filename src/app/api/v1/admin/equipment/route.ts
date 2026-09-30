import { apiHandler } from '@/lib/handler'
import { ok, paged, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// GET /api/v1/admin/equipment — moderation queue (draft/active/paused/rejected, optional status filter)
export const GET = apiHandler(async (req) => {
  await requireAuth(['admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') || 20)))
  const status = sp.get('status') || undefined
  const q = sp.get('q')?.trim() || ''

  const where: Record<string, unknown> = { deletedAt: null }
  if (status) where.status = status
  if (q) where.OR = [{ title: { contains: q } }, { description: { contains: q } }]

  const [total, rows] = await Promise.all([
    db.equipment.count({ where: where as never }),
    db.equipment.findMany({
      where: where as never,
      include: equipmentInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return paged(rows, page, limit, total)
})
