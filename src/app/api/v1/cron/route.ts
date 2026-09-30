import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { BookingService } from '@/lib/booking-service'

// POST /api/v1/cron/run — run scheduled jobs (hold release, late detection)
// Can be called by an external scheduler or the internal cron system
export const POST = apiHandler(async (req) => {
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const job = sp.get('job') || 'all'

  const results: Record<string, unknown> = {}

  if (job === 'all' || job === 'release-holds') {
    results.expiredHolds = await BookingService.releaseExpiredHolds()
  }

  if (job === 'all' || job === 'detect-late') {
    results.lateReturns = await BookingService.detectLateReturns()
  }

  return ok(results)
})
