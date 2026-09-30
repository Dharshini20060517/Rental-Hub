 
import { db } from '../src/lib/db'
import { calculateBookingPrice } from '@/lib/booking-service'
import type { PricingRule } from '@/lib/pricing'

// Phase 2+3 seed: 12 months of booking history, payments, disputes, messages
const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

async function main() {
  console.log('Seeding Phase 2+3 booking history…')

  // Get all equipment, customers, owners
  const allEquipment = await db.equipment.findMany({
    where: { deletedAt: null, status: 'active' },
    select: { id: true, ownerId: true, baseDailyPrice: true, baseDeposit: true, pricingRules: true, cancellationPolicy: true, autoApprove: true },
  })
  const customers = await db.user.findMany({ where: { role: 'customer', deletedAt: null }, select: { id: true } })
  if (allEquipment.length === 0 || customers.length === 0) {
    console.log('No equipment or customers found. Run the main seed first.')
    return
  }

  // Clear existing bookings
  await db.disputeMessage.deleteMany({})
  await db.dispute.deleteMany({})
  await db.bookingMessage.deleteMany({})
  await db.payment.deleteMany({})
  await db.bookingStatusHistory.deleteMany({})
  await db.booking.deleteMany({})
  await db.priceSuggestion.deleteMany({})

  // Remove 'booked' availability blocks from previous seeding
  await db.availabilityBlock.deleteMany({ where: { reason: 'booked' } })

  // Generate ~120 bookings across 12 months
  const bookingsToCreate = 120
  let created = 0

  for (let i = 0; i < bookingsToCreate; i++) {
    const eq = allEquipment[Math.floor(Math.random() * allEquipment.length)]
    const customer = customers[Math.floor(Math.random() * customers.length)]

    // Random start date within last 12 months or next 2 months
    const startOffset = Math.floor(Math.random() * 400) - 30 // -30 to +370 days
    const startDate = daysAgo(startOffset)
    const days = Math.floor(Math.random() * 7) + 1 // 1-7 days
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000)

    // Pricing
    const pricing = calculateBookingPrice(
      eq.baseDailyPrice,
      eq.baseDeposit,
      (eq.pricingRules as PricingRule[]) || [],
      startDate,
      endDate,
    )

    // Determine status based on whether the booking is in the past or future
    let status: string
    let confirmedAt: Date | null = null
    let pickedUpAt: Date | null = null
    let returnedAt: Date | null = null
    let inspectedAt: Date | null = null
    let completedAt: Date | null = null
    let cancelledAt: Date | null = null

    if (startOffset > 0 && endDate < now) {
      // Past booking → completed
      const rand = Math.random()
      if (rand < 0.85) {
        status = 'completed'
        confirmedAt = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
        pickedUpAt = startDate
        returnedAt = endDate
        inspectedAt = new Date(endDate.getTime() + 2 * 60 * 60 * 1000)
        completedAt = new Date(endDate.getTime() + 4 * 60 * 60 * 1000)
      } else if (rand < 0.95) {
        status = 'cancelled'
        cancelledAt = new Date(startDate.getTime() - 48 * 60 * 60 * 1000)
      } else {
        status = 'disputed'
        confirmedAt = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
        pickedUpAt = startDate
        returnedAt = endDate
      }
    } else if (startOffset <= 0 && startOffset > -7) {
      // Currently active → in_use or picked_up
      status = Math.random() < 0.5 ? 'in_use' : 'picked_up'
      confirmedAt = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
      pickedUpAt = startDate
    } else {
      // Future booking → confirmed or held
      status = Math.random() < 0.8 ? 'confirmed' : 'held'
      if (status === 'confirmed') confirmedAt = new Date(startDate.getTime() - 24 * 60 * 60 * 1000)
    }

    const refundAmount = status === 'cancelled' ? pricing.totalAmount * 0.5 : null

    const booking = await db.booking.create({
      data: {
        equipmentId: eq.id,
        customerId: customer.id,
        ownerId: eq.ownerId,
        status,
        startDate,
        endDate,
        days: pricing.days,
        baseAmount: pricing.baseAmount,
        adjustments: pricing.adjustments as never,
        depositAmount: pricing.depositAmount,
        commissionRate: pricing.commissionRate,
        commissionAmount: pricing.commissionAmount,
        totalAmount: pricing.totalAmount,
        cancellationPolicy: eq.cancellationPolicy,
        confirmedAt,
        pickedUpAt,
        returnedAt,
        inspectedAt,
        completedAt,
        cancelledAt,
        refundAmount,
        holdExpiresAt: status === 'held' ? daysFromNow(0.007) : null,
      },
    })

    // Status history
    await db.bookingStatusHistory.create({
      data: { bookingId: booking.id, fromStatus: null, toStatus: 'held', note: 'Booking created' },
    })
    if (confirmedAt) {
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: 'held', toStatus: 'confirmed', createdAt: confirmedAt, note: 'Payment confirmed' },
      })
    }
    if (pickedUpAt) {
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: 'confirmed', toStatus: 'picked_up', createdAt: pickedUpAt, note: 'Equipment picked up' },
      })
    }
    if (returnedAt) {
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: 'in_use', toStatus: 'returned', createdAt: returnedAt, note: 'Equipment returned' },
      })
    }
    if (completedAt) {
      await db.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: 'inspected', toStatus: 'completed', createdAt: completedAt, note: 'Booking completed' },
      })
    }

    // Payment records for confirmed+ bookings
    if (confirmedAt) {
      await db.payment.create({
        data: {
          bookingId: booking.id, userId: customer.id, type: 'charge',
          amount: pricing.totalAmount, status: 'completed',
          reference: `sim_charge_seed_${booking.id.slice(-6)}`,
        },
      })
      await db.payment.create({
        data: {
          bookingId: booking.id, userId: customer.id, type: 'hold',
          amount: pricing.depositAmount, status: 'completed',
          reference: `sim_hold_seed_${booking.id.slice(-6)}`,
        },
      })
      if (status === 'completed') {
        await db.payment.create({
          data: {
            bookingId: booking.id, userId: eq.ownerId, type: 'release',
            amount: pricing.depositAmount, status: 'completed',
            reference: `sim_release_seed_${booking.id.slice(-6)}`,
          },
        })
      }
    }

    // Add a few disputes (5% of bookings)
    if (status === 'disputed') {
      const dispute = await db.dispute.create({
        data: {
          bookingId: booking.id,
          raisedById: Math.random() < 0.5 ? customer.id : eq.ownerId,
          againstId: Math.random() < 0.5 ? eq.ownerId : customer.id,
          reason: ['damage', 'late_return', 'wrong_item', 'payment', 'other'][Math.floor(Math.random() * 5)],
          description: 'Equipment was not returned in the expected condition.',
          status: Math.random() < 0.5 ? 'open' : 'admin_reviewing',
        },
      })
      await db.disputeMessage.create({
        data: {
          disputeId: dispute.id, senderId: customer.id, message: 'I returned the equipment in the same condition I received it.',
        },
      })
      await db.disputeMessage.create({
        data: {
          disputeId: dispute.id, senderId: eq.ownerId, message: 'There are scratches that were not there before.',
        },
      })
    }

    // Add a few booking messages
    if (Math.random() < 0.3) {
      await db.bookingMessage.create({
        data: { bookingId: booking.id, senderId: customer.id, message: 'Hi, what time should I pick up the equipment?' },
      })
      await db.bookingMessage.create({
        data: { bookingId: booking.id, senderId: eq.ownerId, message: 'You can come anytime between 9am and 6pm.' },
      })
    }

    // Add availability block for non-completed/cancelled bookings
    if (['confirmed', 'held', 'picked_up', 'in_use', 'return_pending'].includes(status)) {
      await db.availabilityBlock.create({
        data: { equipmentId: eq.id, ownerId: eq.ownerId, startDate, endDate, reason: 'booked' },
      })
    }

    created++
  }

  // Update trust scores based on booking history
  for (const customer of customers) {
    const completed = await db.booking.count({ where: { customerId: customer.id, status: 'completed' } })
    const cancelled = await db.booking.count({ where: { customerId: customer.id, status: 'cancelled' } })
    const disputed = await db.booking.count({ where: { customerId: customer.id, status: 'disputed' } })
    const score = Math.max(0, Math.min(100, 50 + completed * 5 - cancelled * 3 - disputed * 10))
    await db.user.update({ where: { id: customer.id }, data: { trustScore: score } })
  }

  console.log(`Seeded ${created} bookings ✅`)
  console.log(`  - Payments, status history, messages, disputes included`)
  console.log(`  - Trust scores updated for ${customers.length} customers`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
