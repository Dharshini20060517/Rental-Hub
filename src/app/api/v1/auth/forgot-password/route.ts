import { apiHandler } from '@/lib/handler'
import { ok, failFromZod } from '@/lib/api'
import { resetRequestSchema } from '@/lib/validators'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import crypto from 'crypto'

export const POST = apiHandler(async (req) => {
  const body = await req.json()
  const parsed = resetRequestSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (user && !user.isSuspended && !user.deletedAt) {
    const token = crypto.randomBytes(24).toString('hex')
    const expiry = new Date(Date.now() + 1000 * 60 * 60) // 1h
    await db.user.update({ where: { id: user.id }, data: { resetToken: token, resetTokenExpiry: expiry } })
    // Dev transport: console (Nodemailer Ethereal equivalent). In prod, send via SMTP.
    const link = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/?view=reset-password&token=${token}`
    console.log(`[DEV MAIL] Password reset link for ${user.email}:\n  ${link}`)
    await audit({ action: 'PASSWORD_RESET_REQUESTED', resource: 'user', resourceId: user.id })
  }

  // Always return success to avoid email enumeration
  return ok({ sent: true })
}, { limit: { windowMs: 60000, max: 6 } })
