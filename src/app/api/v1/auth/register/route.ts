import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { registerSchema } from '@/lib/validators'
import { hashPassword, signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { userSelect } from '@/lib/serializers'

export const POST = apiHandler(async (req) => {
  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const data = parsed.data

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } })
  if (existing) throw new HttpError('EMAIL_TAKEN', 'An account with this email already exists.', 409)

  if (data.role === 'owner' && data.accountType === 'business' && !data.businessName) {
    throw new HttpError('VALIDATION_ERROR', 'Business name required for business accounts.', 422)
  }

  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      accountType: data.accountType ?? (data.role === 'owner' ? 'individual' : null),
      businessName: data.businessName ?? null,
      registrationNumber: data.registrationNumber ?? null,
      phone: data.phone ?? null,
    },
    select: userSelect,
  })

  await audit({ action: 'USER_REGISTERED', resource: 'user', resourceId: user.id, metadata: { role: data.role } })

  const access = signAccessToken(user.id, user.role)
  const refresh = signRefreshToken(user.id, user.role)
  const res = ok(user, 201)
  setAuthCookies(res as unknown as Response, access, refresh)
  return res
}, { limit: { windowMs: 60000, max: 10 } })
