import { db } from '@/lib/db'
import { cookies } from 'next/headers'

export async function audit(opts: {
  action: string
  resource: string
  resourceId?: string
  actorId?: string
  targetId?: string
  metadata?: unknown
  ip?: string
}) {
  try {
    const session = opts.actorId ? { id: opts.actorId } : await getActorFromCookie()
    await db.auditLog.create({
      data: {
        actorId: session?.id ?? null,
        targetId: opts.targetId ?? null,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId ?? null,
        metadata: (opts.metadata as object) ?? null,
        ip: opts.ip ?? null,
      },
    })
  } catch (e) {
    console.error('[audit] failed', e)
  }
}

async function getActorFromCookie(): Promise<{ id: string } | null> {
  try {
    const store = await cookies()
    const access = store.get('rh_access')?.value
    if (!access) return null
    // verify quickly via auth
    const { verifyToken } = await import('@/lib/auth')
    const p = verifyToken(access)
    return p && p.type === 'access' ? { id: p.sub } : null
  } catch {
    return null
  }
}
