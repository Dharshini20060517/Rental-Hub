import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

const bundleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  discountPercent: z.number().min(0).max(50).default(10),
  items: z.array(z.object({ equipmentId: z.string().cuid(), required: z.boolean().default(false) })).min(2),
})

// GET /api/v1/bundles — list smart bundles
export const GET = apiHandler(async () => {
  const bundles = await db.bundle.findMany({
    where: { status: 'active' },
    include: {
      items: {
        include: {
          equipment: {
            select: { id: true, title: true, baseDailyPrice: true, city: true, status: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } },
          },
        },
      },
    },
  })

  const enriched = bundles.map(b => {
    const totalBasePrice = b.items.reduce((sum, item) => sum + item.equipment.baseDailyPrice, 0)
    const discountedPrice = Math.round(totalBasePrice * (1 - b.discountPercent / 100))
    return { ...b, totalBasePrice, discountedPrice, savings: totalBasePrice - discountedPrice }
  })

  return ok(enriched)
})

// POST /api/v1/bundles — create a smart bundle (admin/owner)
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['owner', 'admin'])
  const body = await req.json()
  const parsed = bundleSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  // Verify equipment ownership (if owner, all items must be theirs)
  if (session.role === 'owner') {
    for (const item of parsed.data.items) {
      const eq = await db.equipment.findUnique({ where: { id: item.equipmentId }, select: { ownerId: true } })
      if (!eq || eq.ownerId !== session.id) throw new HttpError('FORBIDDEN', 'You can only bundle your own equipment.', 403)
    }
  }

  const bundle = await db.bundle.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      discountPercent: parsed.data.discountPercent,
      items: { create: parsed.data.items.map(item => ({ equipmentId: item.equipmentId, required: item.required })) },
    },
    include: { items: true },
  })

  await audit({ action: 'BUNDLE_CREATED', resource: 'bundle', resourceId: bundle.id, actorId: session.id })
  return ok(bundle, 201)
})
