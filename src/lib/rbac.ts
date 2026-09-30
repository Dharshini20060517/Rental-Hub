import { getSession, type SessionUser } from '@/lib/auth'
import { HttpError } from '@/lib/api'

export const ROLES = ['customer', 'owner', 'admin'] as const
export type Role = (typeof ROLES)[number]

/** Require an authenticated session; optionally restricted to given roles. */
export async function requireAuth(roles?: Role[]): Promise<NonNullable<SessionUser>> {
  const session = await getSession()
  if (!session) throw new HttpError('UNAUTHENTICATED', 'Authentication required.', 401)
  if (roles && !roles.includes(session.role as Role)) {
    throw new HttpError('FORBIDDEN', 'You do not have permission to perform this action.', 403)
  }
  return session as NonNullable<SessionUser>
}

/** Non-throwing version: returns session or null. */
export async function optionalAuth(): Promise<SessionUser> {
  return getSession()
}

export function assertOwner(resourceOwnerId: string, actorId: string, isAdmin = false) {
  if (isAdmin) return
  if (resourceOwnerId !== actorId) {
    throw new HttpError('FORBIDDEN', 'You do not have permission to access this resource.', 403)
  }
}

/** Pagination + sort params from a URLSearchParams. */
export function parseListParams(sp: URLSearchParams) {
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') || 12)))
  const sort = sp.get('sort') || 'createdAt' // createdAt | price | rating | distance
  const order = (sp.get('order') || 'desc') === 'asc' ? 'asc' : 'desc'
  const q = sp.get('q')?.trim() || ''
  return { page, limit, sort, order, q }
}
