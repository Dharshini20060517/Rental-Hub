import { db } from '@/lib/db'
import { HttpError } from '@/lib/api'
import { calculatePrice, type PricingRule } from '@/lib/pricing'

// ===== Booking State Machine =====
// pending → held → confirmed → picked_up → in_use → return_pending → returned → inspected → completed
// plus: cancelled, late, disputed

export const BOOKING_STATUS = {
  PENDING: 'pending',
  HELD: 'held',
  CONFIRMED: 'confirmed',
  PICKED_UP: 'picked_up',
  IN_USE: 'in_use',
  RETURN_PENDING: 'return_pending',
  RETURNED: 'returned',
  INSPECTED: 'inspected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  LATE: 'late',
  DISPUTED: 'disputed',
} as const

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS]

const ACTIVE_STATUSES = ['held', 'confirmed', 'picked_up', 'in_use', 'return_pending', 'returned', 'inspected']

// Legal transitions
const TRANSITIONS: Record<string, string[]> = {
  pending: ['held', 'cancelled'],
  held: ['confirmed', 'cancelled'],
  confirmed: ['picked_up', 'cancelled'],
  picked_up: ['in_use', 'cancelled', 'late'],
  in_use: ['return_pending', 'late'],
  return_pending: ['returned', 'late'],
  returned: ['inspected'],
  inspected: ['completed', 'disputed'],
  late: ['returned', 'disputed', 'cancelled'],
  completed: ['disputed'],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
}

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from] || []).includes(to)
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) {
    throw new HttpError('INVALID_TRANSITION', `Cannot transition from ${from} to ${to}.`, 422)
  }
}

// ===== Overlap Validation =====
// Checks if a date range conflicts with any existing active booking or availability block.
export async function checkAvailability(
  equipmentId: string,
  startDate: Date,
  endDate: Date,
  excludeBookingId?: string,
): Promise<{ available: boolean; conflicts: { type: string; startDate: Date; endDate: Date }[] }> {
  if (endDate <= startDate) {
    throw new HttpError('VALIDATION_ERROR', 'End date must be after start date.', 422)
  }

  const conflicts: { type: string; startDate: Date; endDate: Date }[] = []

  // Check existing bookings (only active statuses block dates)
  const bookingWhere: Record<string, unknown> = {
    equipmentId,
    status: { in: ACTIVE_STATUSES },
    OR: [
      { startDate: { lte: startDate }, endDate: { gt: startDate } },
      { startDate: { lt: endDate }, endDate: { gte: endDate } },
      { startDate: { gte: startDate }, endDate: { lte: endDate } },
    ],
  }
  if (excludeBookingId) bookingWhere.id = { not: excludeBookingId }

  const conflictingBookings = await db.booking.findMany({
    where: bookingWhere as never,
    select: { id: true, startDate: true, endDate: true },
  })
  for (const b of conflictingBookings) {
    conflicts.push({ type: 'booking', startDate: b.startDate, endDate: b.endDate })
  }

  // Check availability blocks (owner_blocked, maintenance, booked)
  const blocks = await db.availabilityBlock.findMany({
    where: {
      equipmentId,
      OR: [
        { startDate: { lte: startDate }, endDate: { gt: startDate } },
        { startDate: { lt: endDate }, endDate: { gte: endDate } },
        { startDate: { gte: startDate }, endDate: { lte: endDate } },
      ],
    },
  })
  for (const b of blocks) {
    conflicts.push({ type: b.reason, startDate: b.startDate, endDate: b.endDate })
  }

  // Check maintenance windows
  const windows = await db.maintenanceWindow.findMany({
    where: {
      equipmentId,
      OR: [
        { startDate: { lte: startDate }, endDate: { gt: startDate } },
        { startDate: { lt: endDate }, endDate: { gte: endDate } },
        { startDate: { gte: startDate }, endDate: { lte: endDate } },
      ],
    },
  })
  for (const w of windows) {
    conflicts.push({ type: 'maintenance', startDate: w.startDate, endDate: w.endDate })
  }

  return { available: conflicts.length === 0, conflicts }
}

// ===== Pricing =====
export function calculateBookingPrice(
  baseDailyPrice: number,
  baseDeposit: number,
  pricingRules: PricingRule[],
  startDate: Date,
  endDate: Date,
): {
  days: number
  baseAmount: number
  adjustments: { label: string; amount: number; type: string }[]
  depositAmount: number
  totalAmount: number
  commissionRate: number
  commissionAmount: number
} {
  const breakdown = calculatePrice(baseDailyPrice, baseDeposit, startDate, endDate, pricingRules)
  const commissionRate = 10 // 10% platform commission
  const commissionAmount = Math.round((breakdown.total * commissionRate) / 100)

  return {
    days: breakdown.days,
    baseAmount: breakdown.baseTotal,
    adjustments: breakdown.adjustments.map((a) => ({ label: a.label, amount: a.amount, type: a.type })),
    depositAmount: breakdown.deposit,
    totalAmount: breakdown.total,
    commissionRate,
    commissionAmount,
  }
}

// ===== Cancellation Refund =====
export function calculateRefund(
  booking: { totalAmount: number; cancellationPolicy: string; startDate: Date; status: string },
  cancelledAt: Date = new Date(),
): number {
  if (booking.status === 'completed' || booking.status === 'returned') return 0

  const hoursUntilStart = (booking.startDate.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60)

  switch (booking.cancellationPolicy) {
    case 'flexible':
      // Full refund if >24h before, 50% if within 24h
      return hoursUntilStart > 24 ? booking.totalAmount : booking.totalAmount * 0.5
    case 'moderate':
      // 50% if >48h, 25% if within 48h
      return hoursUntilStart > 48 ? booking.totalAmount * 0.5 : booking.totalAmount * 0.25
    case 'strict':
      // 25% if >72h, 0% if within 72h
      return hoursUntilStart > 72 ? booking.totalAmount * 0.25 : 0
    default:
      return booking.totalAmount
  }
}

// ===== Booking Service =====
export class BookingService {
  // Create a booking (held state with 10-min checkout hold)
  static async createBooking(opts: {
    equipmentId: string
    customerId: string
    startDate: Date
    endDate: Date
    idempotencyKey?: string
  }): Promise<{ id: string; status: string; holdExpiresAt: Date; totalAmount: number; depositAmount: number }> {
    // Idempotency check
    if (opts.idempotencyKey) {
      const existing = await db.booking.findUnique({ where: { idempotencyKey: opts.idempotencyKey } })
      if (existing) {
        return {
          id: existing.id,
          status: existing.status,
          holdExpiresAt: existing.holdExpiresAt!,
          totalAmount: existing.totalAmount,
          depositAmount: existing.depositAmount,
        }
      }
    }

    // Fetch equipment
    const equipment = await db.equipment.findUnique({
      where: { id: opts.equipmentId },
      select: {
        id: true, ownerId: true, baseDailyPrice: true, baseDeposit: true,
        pricingRules: true, bufferHours: true, cancellationPolicy: true, autoApprove: true,
        status: true, deletedAt: true,
      },
    })
    if (!equipment || equipment.deletedAt) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)
    if (equipment.status !== 'active') throw new HttpError('BAD_REQUEST', 'This equipment is not available for booking.', 400)

    // Apply buffer time
    const bufferMs = equipment.bufferHours * 60 * 60 * 1000
    const startWithBuffer = new Date(opts.startDate.getTime() - bufferMs)
    const endWithBuffer = new Date(opts.endDate.getTime() + bufferMs)

    // Check availability (with buffer)
    const { available, conflicts } = await checkAvailability(opts.equipmentId, startWithBuffer, endWithBuffer)
    if (!available) {
      throw new HttpError('SLOT_UNAVAILABLE', 'The selected dates overlap with an existing booking or block.', 409, { conflicts })
    }

    // Calculate price
    const pricing = calculateBookingPrice(
      equipment.baseDailyPrice,
      equipment.baseDeposit,
      (equipment.pricingRules as PricingRule[]) || [],
      opts.startDate,
      opts.endDate,
    )

    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const booking = await db.booking.create({
      data: {
        equipmentId: opts.equipmentId,
        customerId: opts.customerId,
        ownerId: equipment.ownerId,
        status: BOOKING_STATUS.HELD, // Start in HELD (checkout hold)
        startDate: opts.startDate,
        endDate: opts.endDate,
        days: pricing.days,
        baseAmount: pricing.baseAmount,
        adjustments: pricing.adjustments as never,
        depositAmount: pricing.depositAmount,
        commissionRate: pricing.commissionRate,
        commissionAmount: pricing.commissionAmount,
        totalAmount: pricing.totalAmount,
        cancellationPolicy: equipment.cancellationPolicy,
        holdExpiresAt,
        idempotencyKey: opts.idempotencyKey,
      },
    })

    // Create status history
    await db.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: null,
        toStatus: BOOKING_STATUS.HELD,
        actorId: opts.customerId,
        note: 'Booking created with 10-min hold',
      },
    })

    // Create availability block (reason: booked)
    await db.availabilityBlock.create({
      data: {
        equipmentId: opts.equipmentId,
        ownerId: equipment.ownerId,
        startDate: opts.startDate,
        endDate: opts.endDate,
        reason: 'booked',
      },
    })

    return {
      id: booking.id,
      status: booking.status,
      holdExpiresAt,
      totalAmount: pricing.totalAmount,
      depositAmount: pricing.depositAmount,
    }
  }

  // Confirm a held booking (after payment)
  static async confirmBooking(bookingId: string, actorId: string): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.customerId !== actorId) throw new HttpError('FORBIDDEN', 'Only the customer can confirm.', 403)

    assertTransition(booking.status, BOOKING_STATUS.CONFIRMED)

    // If auto-approve, go straight to confirmed; else need owner approval
    const equipment = await db.equipment.findUnique({ where: { id: booking.equipmentId }, select: { autoApprove: true } })

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: {
        status: BOOKING_STATUS.CONFIRMED,
        confirmedAt: new Date(),
        holdExpiresAt: null,
      },
    })

    await db.bookingStatusHistory.create({
      data: {
        bookingId,
        fromStatus: booking.status,
        toStatus: BOOKING_STATUS.CONFIRMED,
        actorId,
        note: equipment?.autoApprove ? 'Auto-approved' : 'Payment confirmed',
      },
    })

    return { id: updated.id, status: updated.status }
  }

  // Owner approves/rejects a booking request
  static async ownerApprove(bookingId: string, ownerId: string, approve: boolean): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.ownerId !== ownerId) throw new HttpError('FORBIDDEN', 'Only the owner can approve.', 403)

    if (approve) {
      assertTransition(booking.status, BOOKING_STATUS.CONFIRMED)
      const updated = await db.booking.update({
        where: { id: bookingId },
        data: { status: BOOKING_STATUS.CONFIRMED, confirmedAt: new Date(), holdExpiresAt: null },
      })
      await db.bookingStatusHistory.create({
        data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.CONFIRMED, actorId: ownerId, note: 'Owner approved' },
      })
      return { id: updated.id, status: updated.status }
    } else {
      return this.cancelBooking(bookingId, ownerId, 'Owner rejected booking request')
    }
  }

  // Cancel a booking
  static async cancelBooking(bookingId: string, actorId: string, reason: string): Promise<{ id: string; status: string; refundAmount: number }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.customerId !== actorId && booking.ownerId !== actorId) {
      throw new HttpError('FORBIDDEN', 'Only the customer or owner can cancel.', 403)
    }

    assertTransition(booking.status, BOOKING_STATUS.CANCELLED)

    const refundAmount = calculateRefund(booking)

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: {
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
        refundAmount,
      },
    })

    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.CANCELLED, actorId, note: reason },
    })

    // Remove the availability block for this booking
    await db.availabilityBlock.deleteMany({
      where: { equipmentId: booking.equipmentId, reason: 'booked', startDate: booking.startDate, endDate: booking.endDate },
    })

    return { id: updated.id, status: updated.status, refundAmount }
  }

  // Pickup (customer picks up equipment)
  static async pickup(bookingId: string, actorId: string, checklist?: Record<string, boolean>, photos?: string[]): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    assertTransition(booking.status, BOOKING_STATUS.PICKED_UP)

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: {
        status: BOOKING_STATUS.PICKED_UP,
        pickedUpAt: new Date(),
        pickupChecklist: checklist || null,
        pickupPhotos: photos || null,
      },
    })

    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.PICKED_UP, actorId, note: 'Equipment picked up' },
    })

    return { id: updated.id, status: updated.status }
  }

  // Start using (owner confirms customer has the equipment)
  static async startUsing(bookingId: string, actorId: string): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.ownerId !== actorId && booking.customerId !== actorId) {
      throw new HttpError('FORBIDDEN', 'Not authorized.', 403)
    }
    assertTransition(booking.status, BOOKING_STATUS.IN_USE)

    const updated = await db.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.IN_USE } })
    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.IN_USE, actorId },
    })
    return { id: updated.id, status: updated.status }
  }

  // Return pending (customer initiates return)
  static async initiateReturn(bookingId: string, actorId: string): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.customerId !== actorId) throw new HttpError('FORBIDDEN', 'Only the customer can initiate return.', 403)
    assertTransition(booking.status, BOOKING_STATUS.RETURN_PENDING)

    const updated = await db.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.RETURN_PENDING } })
    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.RETURN_PENDING, actorId, note: 'Return initiated' },
    })
    return { id: updated.id, status: updated.status }
  }

  // Returned (owner receives the equipment)
  static async confirmReturn(bookingId: string, actorId: string, checklist?: Record<string, boolean>, photos?: string[]): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.ownerId !== actorId) throw new HttpError('FORBIDDEN', 'Only the owner can confirm return.', 403)
    assertTransition(booking.status, BOOKING_STATUS.RETURNED)

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: {
        status: BOOKING_STATUS.RETURNED,
        returnedAt: new Date(),
        returnChecklist: checklist || null,
        returnPhotos: photos || null,
      },
    })
    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.RETURNED, actorId, note: 'Equipment returned' },
    })
    return { id: updated.id, status: updated.status }
  }

  // Inspected (owner inspects and marks complete)
  static async inspect(bookingId: string, actorId: string, pass: boolean): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.ownerId !== actorId) throw new HttpError('FORBIDDEN', 'Only the owner can inspect.', 403)
    assertTransition(booking.status, BOOKING_STATUS.INSPECTED)

    const newStatus = pass ? BOOKING_STATUS.INSPECTED : BOOKING_STATUS.DISPUTED
    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: newStatus, inspectedAt: new Date() },
    })
    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: newStatus, actorId, note: pass ? 'Inspection passed' : 'Inspection failed - dispute' },
    })
    return { id: updated.id, status: updated.status }
  }

  // Complete (release deposit, finalize)
  static async complete(bookingId: string, actorId: string): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    assertTransition(booking.status, BOOKING_STATUS.COMPLETED)

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_STATUS.COMPLETED, completedAt: new Date() },
    })
    await db.bookingStatusHistory.create({
      data: { bookingId, fromStatus: booking.status, toStatus: BOOKING_STATUS.COMPLETED, actorId, note: 'Booking completed' },
    })

    // Remove the availability block
    await db.availabilityBlock.deleteMany({
      where: { equipmentId: booking.equipmentId, reason: 'booked', startDate: booking.startDate, endDate: booking.endDate },
    })

    return { id: updated.id, status: updated.status }
  }

  // Request extension
  static async requestExtension(bookingId: string, customerId: string, newEndDate: Date): Promise<{ id: string; status: string }> {
    const booking = await db.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new HttpError('NOT_FOUND', 'Booking not found.', 404)
    if (booking.customerId !== customerId) throw new HttpError('FORBIDDEN', 'Only the customer can request extension.', 403)
    if (newEndDate <= booking.endDate) throw new HttpError('VALIDATION_ERROR', 'New end date must be after current end date.', 422)

    // Check availability for the extended period
    const { available, conflicts } = await checkAvailability(booking.equipmentId, booking.endDate, newEndDate, bookingId)
    if (!available) {
      throw new HttpError('SLOT_UNAVAILABLE', 'Extension conflicts with another booking.', 409, { conflicts })
    }

    // Recalculate price
    const equipment = await db.equipment.findUnique({
      where: { id: booking.equipmentId },
      select: { baseDailyPrice: true, baseDeposit: true, pricingRules: true },
    })
    if (!equipment) throw new HttpError('NOT_FOUND', 'Equipment not found.', 404)

    const pricing = calculateBookingPrice(
      equipment.baseDailyPrice,
      equipment.baseDeposit,
      (equipment.pricingRules as PricingRule[]) || [],
      booking.startDate,
      newEndDate,
    )

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: {
        endDate: newEndDate,
        days: pricing.days,
        baseAmount: pricing.baseAmount,
        adjustments: pricing.adjustments as never,
        totalAmount: pricing.totalAmount,
        commissionAmount: pricing.commissionAmount,
      },
    })

    // Update the availability block
    await db.availabilityBlock.updateMany({
      where: { equipmentId: booking.equipmentId, reason: 'booked', startDate: booking.startDate },
      data: { endDate: newEndDate },
    })

    return { id: updated.id, status: updated.status }
  }

  // Release expired holds (called by cron)
  static async releaseExpiredHolds(): Promise<number> {
    const expired = await db.booking.findMany({
      where: { status: BOOKING_STATUS.HELD, holdExpiresAt: { lt: new Date() } },
      select: { id: true, equipmentId: true, startDate: true, endDate: true },
    })

    for (const booking of expired) {
      await db.booking.update({
        where: { id: booking.id },
        data: { status: BOOKING_STATUS.CANCELLED, cancelledAt: new Date(), cancelReason: 'Hold expired' },
      })
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: BOOKING_STATUS.HELD, toStatus: BOOKING_STATUS.CANCELLED, note: 'Hold expired (auto)' },
      })
      await db.availabilityBlock.deleteMany({
        where: { equipmentId: booking.equipmentId, reason: 'booked', startDate: booking.startDate, endDate: booking.endDate },
      })
    }

    return expired.length
  }

  // Detect late returns (called by cron)
  static async detectLateReturns(): Promise<number> {
    const now = new Date()
    const overdue = await db.booking.findMany({
      where: {
        status: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PICKED_UP, BOOKING_STATUS.IN_USE, BOOKING_STATUS.RETURN_PENDING] },
        endDate: { lt: now },
      },
      select: { id: true },
    })

    for (const booking of overdue) {
      await db.booking.update({ where: { id: booking.id }, data: { status: BOOKING_STATUS.LATE } })
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, toStatus: BOOKING_STATUS.LATE, note: 'Auto-detected late return' },
      })
    }

    return overdue.length
  }
}
