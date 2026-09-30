import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { verifyToken, getRefreshCookie, signAccessToken, setAuthCookies, COOKIE_ACCESS } from '@/lib/auth'
import { db } from '@/lib/db'
import { userSelect } from '@/lib/serializers'
import { cookies } from 'next/headers'

export const POST = apiHandler(async (req) => {
  const refreshCookie = await getRefreshCookie()
  if (!refreshCookie) throw new HttpError('NO_REFRESH_TOKEN', 'No refresh token provided.', 401)

  const payload = verifyToken(refreshCookie)
  if (!payload || payload.type !== 'refresh') {
    throw new HttpError('INVALID_REFRESH_TOKEN', 'Refresh token invalid or expired. Please log in again.', 401)
  }

  const user = await db.user.findUnique({ where: { id: payload.sub }, select: userSelect })
  if (!user || user.isSuspended || user.deletedAt) {
    throw new HttpError('ACCOUNT_DISABLED', 'Account disabled or suspended.', 403)
  }

  const access = signAccessToken(user.id, user.role)
  // Rotate refresh token
  const { signRefreshToken } = await import('@/lib/auth')
  const newRefresh = signRefreshToken(user.id, user.role)
  const res = ok(user)
  setAuthCookies(res as unknown as Response, access, newRefresh)
  return res
})
