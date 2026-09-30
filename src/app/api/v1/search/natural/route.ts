import { apiHandler } from '@/lib/handler'
import { ok } from '@/lib/api'
import { db } from '@/lib/db'
import { equipmentInclude } from '@/lib/serializers'

// POST /api/v1/search/natural — natural language search parsed into filters
// Example: "DSLR and two lights for a weekend shoot under ₹5000"
export const POST = apiHandler(async (req) => {
  const body = await req.json()
  const query: string = body?.query || ''

  if (!query.trim()) return ok({ parsed: {}, results: [] })

  // Parse natural language query into filters
  const lowerQ = query.toLowerCase()

  // Extract price
  const priceMatch = lowerQ.match(/(?:under|below|less than|upto|up to)\s*₹?(\d+)/)
  const maxPrice = priceMatch ? Number(priceMatch[1]) : undefined

  // Extract keywords
  const keywords = lowerQ
    .replace(/(?:under|below|less than|upto|up to)\s*₹?\d+/g, '')
    .replace(/(?:for|a|an|the|with|and|weekend|shoot|event|project)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Match categories
  const categoryMap: Record<string, string> = {
    camera: 'photography', dslr: 'photography', lens: 'photography', lighting: 'photography',
    drill: 'power-tools', saw: 'power-tools', sander: 'power-tools',
    excavator: 'earthmoving', loader: 'earthmoving', compactor: 'earthmoving',
    tent: 'party-events', table: 'party-events', chair: 'party-events',
    mixer: 'construction', scaffolding: 'construction',
    van: 'vehicles', truck: 'vehicles', pickup: 'vehicles',
    speaker: 'audio-video', projector: 'audio-video', microphone: 'audio-video',
    washer: 'cleaning', vacuum: 'cleaning',
    backpack: 'camping-outdoor', stove: 'camping-outdoor',
  }

  let matchedCategory: string | undefined
  for (const [kw, slug] of Object.entries(categoryMap)) {
    if (lowerQ.includes(kw)) { matchedCategory = slug; break }
  }

  // Extract duration
  const weekendMatch = lowerQ.includes('weekend')
  const weekMatch = lowerQ.includes('week')

  const parsed = {
    q: keywords || undefined,
    category: matchedCategory,
    maxPrice,
    duration: weekendMatch ? 2 : weekMatch ? 7 : undefined,
  }

  // Execute search with parsed filters
  const where: Record<string, unknown> = { deletedAt: null, status: 'active' }
  if (parsed.q) {
    where.OR = [
      { title: { contains: parsed.q } },
      { description: { contains: parsed.q } },
    ]
  }
  if (parsed.category) {
    const cat = await db.category.findFirst({ where: { slug: parsed.category } })
    if (cat) where.categoryId = cat.id
  }
  if (parsed.maxPrice) where.baseDailyPrice = { lte: parsed.maxPrice }

  const results = await db.equipment.findMany({
    where: where as never,
    include: equipmentInclude,
    take: 12,
    orderBy: { createdAt: 'desc' },
  })

  return ok({ parsed, results, resultCount: results.length })
})
