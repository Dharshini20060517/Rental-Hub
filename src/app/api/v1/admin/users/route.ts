import { apiHandler } from '@/lib/handler'
import { ok, paged, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { userSelect } from '@/lib/serializers'

// GET /api/v1/admin/users — list users (with filters)
export const GET = apiHandler(async (req) => {
  await requireAuth(['admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 20)))
  const role = sp.get('role') || undefined
  const q = sp.get('q')?.trim() || ''
  const suspended = sp.get('suspended')
  const verified = sp.get('verified')

  const where: Record<string, unknown> = { deletedAt: null }
  if (role) where.role = role
  if (suspended === 'true') where.isSuspended = true
  if (suspended === 'false') where.isSuspended = false
  if (verified === 'true') where.isVerified = true
  if (verified === 'false') where.isVerified = false
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { businessName: { contains: q } },
    ]
  }

  const [total, rows] = await Promise.all([
    db.user.count({ where: where as never }),
    db.user.findMany({
      where: where as never,
      select: { ...userSelect, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return paged(rows, page, limit, total)
})
