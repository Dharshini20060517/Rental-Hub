import { apiHandler, getParams } from '@/lib/handler'
import { ok, failFromZod, HttpError } from '@/lib/api'
import { maintenanceWindowSchema } from '@/lib/validators'
import { requireAuth, assertOwner } from '@/lib/rbac'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'

// GET /api/v1/equipment/[id]/maintenance-windows
export const GET = apiHandler(async (req, ctx) => {
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { deletedAt: true } })
  if (!item || item.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  const windows = await db.maintenanceWindow.findMany({
    where: { equipmentId: id },
    orderBy: { startDate: 'asc' },
  })
  return ok(windows)
})

// POST /api/v1/equipment/[id]/maintenance-windows — schedule maintenance window
export const POST = apiHandler(async (req, ctx) => {
  const session = await requireAuth(['owner', 'admin'])
  const { id } = await getParams(ctx)
  const item = await db.equipment.findUnique({ where: { id }, select: { ownerId: true } })
  if (!item) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
  assertOwner(item.ownerId, session.id, session.role === 'admin')

  const body = await req.json()
  const parsed = maintenanceWindowSchema.safeParse(body)
  if (!parsed.success) return failFromZod(parsed.error)

  const start = new Date(parsed.data.startDate)
  const end = new Date(parsed.data.endDate)
  if (end <= start) throw new HttpError('VALIDATION_ERROR', 'End date must be after start date.', 422)

  const win = await db.maintenanceWindow.create({
    data: { equipmentId: id, ownerId: session.id, startDate: start, endDate: end, notes: parsed.data.notes ?? null },
  })
  // automatically create an availability block for this window
  await db.availabilityBlock.create({
    data: { equipmentId: id, ownerId: session.id, startDate: start, endDate: end, reason: 'maintenance' },
  })
  await audit({ action: 'MAINTENANCE_WINDOW_CREATED', resource: 'equipment', resourceId: id, actorId: session.id })
  return ok(win, 201)
})
