import { NextResponse } from 'next/server'

// API envelope: { success, data, error:{code,message,details}, meta:{page,limit,total} }
// Versioned under /api/v1.

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiMeta = {
  page: number
  limit: number
  total: number
  totalPages?: number
} | undefined

export function ok<T>(data: T, status = 200, meta?: ApiMeta) {
  return NextResponse.json({ success: true, data, error: null, meta: meta ?? undefined }, { status })
}

export function paged<T>(rows: T[], page: number, limit: number, total: number) {
  return ok(rows, 200, { page, limit, total, totalPages: Math.ceil(total / limit) || 0 })
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, data: null, error: { code, message, details } },
    { status },
  )
}

export function failFromZod(error: import('zod').ZodError) {
  return fail('VALIDATION_ERROR', 'Request validation failed', 422, error.issues)
}

export class HttpError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return fail(err.code, err.message, err.status, err.details)
  }
  // Prisma known errors
  const e = err as { code?: string; message?: string }
  if (e?.code === 'P2002') {
    return fail('CONFLICT', 'A record with this value already exists.', 409)
  }
  if (e?.code === 'P2025') {
    return fail('NOT_FOUND', 'Record not found.', 404)
  }
  console.error('[api] unhandled', err)
  return fail('INTERNAL_ERROR', 'Something went wrong.', 500)
}
