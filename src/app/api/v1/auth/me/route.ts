import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { userSelect } from '@/lib/serializers'

export const GET = apiHandler(async () => {
  const session = await getSession()
  if (!session) throw new HttpError('UNAUTHENTICATED', 'Authentication required.', 401)
  const user = await db.user.findUnique({ where: { id: session.id }, select: userSelect })
  if (!user || user.deletedAt) throw new HttpError('NOT_FOUND', 'User not found.', 404)
  return ok(user)
})
