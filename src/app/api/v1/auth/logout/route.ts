import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { clearAuthCookies, getSession } from '@/lib/auth'
import { audit } from '@/lib/audit'

export const POST = apiHandler(async (req) => {
  const session = await getSession()
  if (session) await audit({ action: 'USER_LOGOUT', resource: 'user', resourceId: session.id })
  const res = ok({ success: true })
  clearAuthCookies(res as unknown as Response)
  return res
})
