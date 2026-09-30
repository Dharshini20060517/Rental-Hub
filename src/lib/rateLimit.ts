// Simple in-memory rate limiter (per IP+route). Production would use Redis.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000)
const MAX = Number(process.env.RATE_LIMIT_MAX || 120)

export function rateLimit(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? WINDOW_MS
  const max = opts?.max ?? MAX
  return function (key: string): { ok: true } | { ok: false; retryAfter: number } {
    const now = Date.now()
    const b = buckets.get(key)
    if (!b || b.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return { ok: true }
    }
    b.count += 1
    if (b.count > max) {
      return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
    }
    return { ok: true }
  }
}

export function clientIp(req: Request): string {
  const h = req.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    '0.0.0.0'
  )
}

// Sanitize MongoDB-like operators from inputs (defense-in-depth, adapted from mongo sanitization).
export function sanitizeNoSQL<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) return value.map(sanitizeNoSQL) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k.startsWith('$') || k.includes('.')) continue
    out[k] = sanitizeNoSQL(v)
  }
  return out as T
}
