import { NextResponse } from 'next/server'
import { handleError } from '@/lib/api'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export type RouteContext = { params: Promise<Record<string, string>> }

type Handler = (req: Request, ctx: RouteContext) => Promise<Response> | Response

/** Wraps a route handler with error handling + optional per-IP rate limiting. */
export function apiHandler(
  handler: Handler,
  opts?: { limit?: { windowMs?: number; max?: number } },
): Handler {
  return async (req, ctx) => {
    try {
      if (opts?.limit) {
        const rl = rateLimit(opts.limit)
        const res = rl(`rl:${req.nextUrl?.pathname || 'x'}:${clientIp(req)}`)
        if (!res.ok) {
          return NextResponse.json(
            { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retryAfter: res.retryAfter } } },
            { status: 429, headers: { 'Retry-After': String(res.retryAfter) } },
          )
        }
      }
      return await handler(req, ctx)
    } catch (err) {
      return handleError(err)
    }
  }
}

/** Await dynamic route params (Next 16 params is a Promise). */
export async function getParams(ctx: RouteContext): Promise<Record<string, string>> {
  return ctx.params
}
