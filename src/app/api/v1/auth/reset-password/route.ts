import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { resetConfirmSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

export const POST = apiHandler(async (req) => {
  const body = await req.json()
  const parsed = resetConfirmSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const user = await db.user.findFirst({
    where: { resetToken: parsed.data.token, resetTokenExpiry: { gt: new Date() } },
  })
  if (!user) throw new HttpError('INVALID_TOKEN', 'Reset token is invalid or expired.', 400)

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), resetToken: null, resetTokenExpiry: null },
  })
  await audit({ action: 'PASSWORD_RESET', resource: 'user', resourceId: user.id })

  return ok({ success: true })
}, { limit: { windowMs: 60000, max: 10 } })
