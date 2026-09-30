import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { loginSchema } from '@/lib/validators'
import { verifyPassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { userSelect } from '@/lib/serializers'

export const POST = apiHandler(async (req) => {
  const body = await req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (!user) throw new HttpError('INVALID_CREDENTIALS', 'Invalid email or password.', 401)

  const valid = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!valid) throw new HttpError('INVALID_CREDENTIALS', 'Invalid email or password.', 401)

  if (user.isSuspended) throw new HttpError('ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.', 403)
  if (user.deletedAt) throw new HttpError('ACCOUNT_DISABLED', 'Account disabled.', 403)

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const safe = await db.user.findUnique({ where: { id: user.id }, select: userSelect })
  await audit({ action: 'USER_LOGIN', resource: 'user', resourceId: user.id })

  const access = signAccessToken(user.id, user.role)
  const refresh = signRefreshToken(user.id, user.role)
  const res = ok(safe)
  setAuthCookies(res as unknown as Response, access, refresh)
  return res
}, { limit: { windowMs: 60000, max: 12 } })
