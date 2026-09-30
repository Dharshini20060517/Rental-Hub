import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/v1/notifications?filter=unread&page=1&limit=20
export const GET = apiHandler(async (req) => {
  const session = await requireAuth(['customer', 'owner', 'admin'])
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(50, Math.max(1, Number(sp.get('limit') || 20)))
  const filter = sp.get('filter')

  const where: Record<string, unknown> = { userId: session.id }
  if (filter === 'unread') where.isRead = false

  const [total, unreadCount, rows] = await Promise.all([
    db.notification.count({ where: where as never }),
    db.notification.count({ where: { userId: session.id, isRead: false } }),
    db.notification.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const res = NextResponse.json({
    success: true,
    data: rows,
    error: null,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  })
  res.headers.set('x-unread-count', String(unreadCount))
  return res
})
