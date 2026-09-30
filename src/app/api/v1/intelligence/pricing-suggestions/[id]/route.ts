import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { z } from 'zod'
import { requireAuth } from '@/lib/rbac'
import { db } from '@/lib/db'

const actionSchema = z.object({
  action: z.enum(['accept', 'dismiss', 'edit']),
  editedPrice: z.number().min(0).optional(),
})

// POST /api/v1/intelligence/pricing-suggestions/[id] — accept, dismiss, or edit a suggestion
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const body = await req.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const suggestion = await db.priceSuggestion.findUnique({ where: { id } })
  if (!suggestion) throw new HttpError('NOT_FOUND', 'Suggestion not found.', 404)

  const equipment = await db.equipment.findUnique({ where: { id: suggestion.equipmentId }, select: { ownerId: true } })
  if (!equipment || equipment.ownerId !== session.id) {
    throw new HttpError('FORBIDDEN', 'You can only manage suggestions for your own listings.', 403)
  }

  if (parsed.data.action === 'accept') {
    await db.priceSuggestion.update({ where: { id }, data: { status: 'accepted' } })
    await db.equipment.update({ where: { id: suggestion.equipmentId }, data: { baseDailyPrice: suggestion.suggestedPrice } })
    return ok({ status: 'accepted', newPrice: suggestion.suggestedPrice })
  } else if (parsed.data.action === 'dismiss') {
    await db.priceSuggestion.update({ where: { id }, data: { status: 'dismissed' } })
    return ok({ status: 'dismissed' })
  } else {
    if (!parsed.data.editedPrice) throw new HttpError('VALIDATION_ERROR', 'editedPrice required for edit action.', 422)
    await db.priceSuggestion.update({ where: { id }, data: { status: 'edited', editedPrice: parsed.data.editedPrice } })
    await db.equipment.update({ where: { id: suggestion.equipmentId }, data: { baseDailyPrice: parsed.data.editedPrice } })
    return ok({ status: 'edited', newPrice: parsed.data.editedPrice })
  }
})
