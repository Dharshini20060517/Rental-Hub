import { apiHandler } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { equipmentSchema } from '@/lib/validators'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { equipmentInclude } from '@/lib/serializers'
import { haversineKm } from '@/lib/geo'
import { Prisma } from '@prisma/client'

// GET /api/v1/equipment
// Query: q, category(slug|id), minPrice, maxPrice, city, minRating, lat, lng, radiusKm,
//       sort (createdAt|price|rating|distance|title), order (asc|desc), page, limit, status
export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl?.searchParams || new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get('page') || 1))
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') || 12)))
  const sort = sp.get('sort') || 'createdAt'
  const order = (sp.get('order') || 'desc') === 'asc' ? 'asc' : 'desc'
  const q = sp.get('q')?.trim() || ''
  const category = sp.get('category') || ''
  const minPrice = sp.get('minPrice') ? Number(sp.get('minPrice')) : undefined
  const maxPrice = sp.get('maxPrice') ? Number(sp.get('maxPrice')) : undefined
  const city = sp.get('city') || ''
  const minRating = sp.get('minRating') ? Number(sp.get('minRating')) : undefined
  const lat = sp.get('lat') ? Number(sp.get('lat')) : undefined
  const lng = sp.get('lng') ? Number(sp.get('lng')) : undefined
  const radiusKm = sp.get('radiusKm') ? Number(sp.get('radiusKm')) : undefined
  const status = sp.get('status') || 'active'

  const where: Prisma.EquipmentWhereInput = { deletedAt: null }
  if (status === 'all') {
    // include active + paused (not draft/rejected) for browse; drafts excluded
    where.status = { in: ['active', 'paused'] }
  } else if (status === 'active_paused') {
    where.status = { in: ['active', 'paused'] }
  } else {
    where.status = status
  }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { city: { contains: q } },
    ]
  }
  if (category) {
    // slug or id
    const cat = await db.category.findFirst({
      where: { OR: [{ slug: category }, { id: category }] },
      select: { id: true },
    })
    if (cat) where.categoryId = cat.id
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.baseDailyPrice = {}
    if (minPrice !== undefined) where.baseDailyPrice.gte = minPrice
    if (maxPrice !== undefined) where.baseDailyPrice.lte = maxPrice
  }
  if (city) where.city = { contains: city }

  // Fetch matching ids
  const rows = await db.equipment.findMany({
    where,
    select: {
      id: true,
      baseDailyPrice: true,
      lat: true,
      lng: true,
      city: true,
      createdAt: true,
      title: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Rating aggregates
  const ids = rows.map((r) => r.id)
  const reviewAgg = await db.review.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: ids }, status: 'published', deletedAt: null },
    _avg: { rating: true },
    _count: true,
  })
  const ratingMap = new Map<string, { avg: number; count: number }>()
  for (const a of reviewAgg) {
    if (a.equipmentId)
      ratingMap.set(a.equipmentId, {
        avg: a._avg.rating ?? 0,
        count: a._count,
      })
  }

  // Wishlist counts
  const wishAgg = await db.wishlist.groupBy({
    by: ['equipmentId'],
    where: { equipmentId: { in: ids } },
    _count: true,
  })
  const wishMap = new Map<string, number>()
  for (const w of wishAgg) wishMap.set(w.equipmentId, w._count)

  // Build enriched rows for sort + filter
  let enriched = rows.map((r) => ({
    id: r.id,
    baseDailyPrice: r.baseDailyPrice,
    lat: r.lat,
    lng: r.lng,
    city: r.city,
    createdAt: r.createdAt.getTime(),
    title: r.title,
    rating: ratingMap.get(r.id)?.avg ?? 0,
    reviewCount: ratingMap.get(r.id)?.count ?? 0,
    wishlistCount: wishMap.get(r.id) ?? 0,
    distance:
      lat !== undefined && lng !== undefined && r.lat !== null && r.lng !== null
        ? haversineKm({ lat, lng }, { lat: r.lat, lng: r.lng })
        : undefined,
  }))

  // Apply rating + distance filters in JS
  if (minRating !== undefined) {
    enriched = enriched.filter((e) => e.rating >= minRating)
  }
  if (radiusKm !== undefined && lat !== undefined && lng !== undefined) {
    enriched = enriched.filter((e) => e.distance !== undefined && e.distance <= radiusKm)
  }

  // Sort
  const dir = order === 'asc' ? 1 : -1
  enriched.sort((a, b) => {
    switch (sort) {
      case 'price':
        return (a.baseDailyPrice - b.baseDailyPrice) * dir
      case 'rating':
        return (a.rating - b.rating) * dir
      case 'distance': {
        const da = a.distance ?? Infinity
        const db2 = b.distance ?? Infinity
        return (da - db2) * dir
      }
      case 'title':
        return a.title.localeCompare(b.title) * dir
      case 'createdAt':
      default:
        return (a.createdAt - b.createdAt) * dir
    }
  })

  const total = enriched.length
  const start = (page - 1) * limit
  const pageIds = enriched.slice(start, start + limit).map((e) => e.id)

  // Fetch full records for the page
  const items = await db.equipment.findMany({
    where: { id: { in: pageIds } },
    include: equipmentInclude,
  })

  // Preserve the sorted order
  const orderMap = new Map(pageIds.map((id, i) => [id, i]))
  items.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

  // Attach computed fields
  const data = items.map((it) => ({
    ...it,
    rating: ratingMap.get(it.id)?.avg ?? 0,
    reviewCount: ratingMap.get(it.id)?.count ?? 0,
    wishlistCount: wishMap.get(it.id) ?? 0,
    distance:
      lat !== undefined && lng !== undefined && it.lat !== null && it.lng !== null
        ? haversineKm({ lat, lng }, { lat: it.lat, lng: it.lng })
        : undefined,
  }))

  return ok(data, 200, { page, limit, total, totalPages: Math.ceil(total / limit) || 0 })
})

// POST /api/v1/equipment — owner creates a listing
export const POST = apiHandler(async (req) => {
  const session = await requireAuth(['owner', 'admin'])
  const body = await req.json()
  const parsed = equipmentSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)
  const data = parsed.data

  const cat = await db.category.findUnique({ where: { id: data.categoryId } })
  if (!cat || cat.deletedAt) throw new HttpError('NOT_FOUND', 'Category not found.', 404)

  const created = await db.equipment.create({
    data: {
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      ownerId: session.id,
      status: data.status,
      condition: data.condition,
      baseDailyPrice: data.baseDailyPrice,
      baseHourlyPrice: data.baseHourlyPrice ?? null,
      baseDeposit: data.baseDeposit,
      replacementValue: data.replacementValue ?? null,
      pricingRules: (data.pricingRules ?? []) as unknown as Prisma.InputJsonValue,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      city: data.city ?? null,
      address: data.address ?? null,
      bufferHours: data.bufferHours,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      conditionNotes: data.conditionNotes ?? null,
      specs: {
        create: (data.specs ?? []).map((s, i) => ({ key: s.key, value: s.value, order: i })),
      },
    },
    include: equipmentInclude,
  })

  await audit({ action: 'LISTING_CREATED', resource: 'equipment', resourceId: created.id, actorId: session.id })
  return ok(created, 201)
})
