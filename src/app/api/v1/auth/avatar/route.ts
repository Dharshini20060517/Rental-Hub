import { apiHandler } from '@/lib/handler'
import { ok, HttpError } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { userSelect } from '@/lib/serializers'
import { parseAndSaveImage, deleteUpload } from '@/lib/upload'

export const POST = apiHandler(async (req) => {
  const session = await getSession()
  if (!session) throw new HttpError('UNAUTHENTICATED', 'Authentication required.', 401)

  const { url, publicId } = await parseAndSaveImage(req, 'avatar')
  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user) throw new HttpError('NOT_FOUND', 'User not found.', 404)

  const oldPublicId = user.avatarPublicId
  await db.user.update({
    where: { id: session.id },
    data: { avatarUrl: url, avatarPublicId: publicId },
    select: userSelect,
  })

  if (oldPublicId) await deleteUpload(oldPublicId)
  await audit({ action: 'AVATAR_UPDATED', resource: 'user', resourceId: session.id })
  const updated = await db.user.findUnique({ where: { id: session.id }, select: userSelect })
  return ok(updated)
})
