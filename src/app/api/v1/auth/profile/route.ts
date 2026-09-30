import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { profileSchema } from '@/lib/validators'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { userSelect } from '@/lib/serializers'

export const PATCH = apiHandler(async (req) => {
  const session = await getSession()
  if (!session) throw new HttpError('UNAUTHENTICATED', 'Authentication required.', 401)

  const body = await req.json()
  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const data = parsed.data

  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user) throw new HttpError('NOT_FOUND', 'User not found.', 404)

  const updated = await db.user.update({
    where: { id: session.id },
    data: {
      name: data.name ?? undefined,
      phone: data.phone ?? undefined,
      bio: data.bio ?? undefined,
      accountType: data.accountType ?? undefined,
      businessName: data.businessName ?? undefined,
      registrationNumber: data.registrationNumber ?? undefined,
      isOnboarded: true,
    },
    select: userSelect,
  })
  await audit({ action: 'PROFILE_UPDATED', resource: 'user', resourceId: session.id })
  return ok(updated)
})
