import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

type ActivityItem = {
  id: string
  type: 'wishlist' | 'review' | 'maintenance' | 'listing'
  title: string
  description: string
  timestamp: string
  equipmentId?: string
  equipmentTitle?: string
  metadata?: unknown
}

// GET /api/v1/owner/activity — recent activity feed for the logged-in owner
export const GET = apiHandler(async () => {
  const session = await requireAuth(['owner', 'admin'])

  const myEquipment = await db.equipment.findMany({
    where: { ownerId: session.id, deletedAt: null },
    select: { id: true, title: true },
  })
  const eqIds = myEquipment.map((e) => e.id)
  const eqMap = new Map(myEquipment.map((e) => [e.id, e.title]))

  if (eqIds.length === 0) return ok([])

  // Fetch recent wishlists, reviews, maintenance logs in parallel
  const [wishlists, reviews, maintenance, listings] = await Promise.all([
    db.wishlist.findMany({
      where: { equipmentId: { in: eqIds } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.review.findMany({
      where: { equipmentId: { in: eqIds }, status: 'published', deletedAt: null },
      include: { reviewer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.maintenanceLog.findMany({
      where: { ownerId: session.id },
      orderBy: { performedAt: 'desc' },
      take: 10,
    }),
    db.equipment.findMany({
      where: { ownerId: session.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
  ])

  const items: ActivityItem[] = []

  for (const w of wishlists) {
    items.push({
      id: `wl-${w.id}`,
      type: 'wishlist',
      title: 'New wishlist save',
      description: `${w.user.name || 'Someone'} saved "${eqMap.get(w.equipmentId) || 'your equipment'}"`,
      timestamp: w.createdAt.toISOString(),
      equipmentId: w.equipmentId,
      equipmentTitle: eqMap.get(w.equipmentId),
    })
  }

  for (const r of reviews) {
    items.push({
      id: `rv-${r.id}`,
      type: 'review',
      title: `${r.rating}★ review`,
      description: `${r.reviewer.name || 'Someone'} reviewed "${eqMap.get(r.equipmentId) || 'your equipment'}"`,
      timestamp: r.createdAt.toISOString(),
      equipmentId: r.equipmentId || undefined,
      equipmentTitle: r.equipmentId ? eqMap.get(r.equipmentId) : undefined,
      metadata: { rating: r.rating, title: r.title },
    })
  }

  for (const m of maintenance) {
    items.push({
      id: `mn-${m.id}`,
      type: 'maintenance',
      title: 'Maintenance logged',
      description: `"${m.title}" was logged${m.equipmentId ? ` for "${eqMap.get(m.equipmentId) || 'equipment'}"` : ''}`,
      timestamp: m.performedAt.toISOString(),
      equipmentId: m.equipmentId,
      equipmentTitle: m.equipmentId ? eqMap.get(m.equipmentId) : undefined,
      metadata: { cost: m.cost },
    })
  }

  for (const l of listings) {
    items.push({
      id: `ls-${l.id}`,
      type: 'listing',
      title: `Listing ${l.status}`,
      description: `"${l.title}" is now ${l.status}`,
      timestamp: l.createdAt.toISOString(),
      equipmentId: l.id,
      equipmentTitle: l.title,
    })
  }

  // Sort all by timestamp desc, take 15
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return ok(items.slice(0, 15))
})
