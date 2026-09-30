import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { db } from '@/lib/db'

// GET /api/v1/health — platform health check
export const GET = apiHandler(async () => {
  const startTime = Date.now()

  // Check database connectivity
  let dbStatus = 'ok'
  let dbLatency = 0
  try {
    const dbStart = Date.now()
    await db.$queryRaw`SELECT 1`
    dbLatency = Date.now() - dbStart
  } catch {
    dbStatus = 'error'
  }

  // Count records
  const [users, equipment, bookings, disputes] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }).catch(() => -1),
    db.equipment.count({ where: { deletedAt: null } }).catch(() => -1),
    db.booking.count().catch(() => -1),
    db.dispute.count().catch(() => -1),
  ])

  const uptime = process.uptime?.() || 0

  return ok({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: `${Math.round(uptime)}s`,
    latency: {
      total: Date.now() - startTime,
      database: dbLatency,
    },
    database: dbStatus,
    stats: { users, equipment, bookings, disputes },
    version: '2.0.0',
    phase: 'Phase 4 — AI Vision, Innovation & Hardening',
  })
})
