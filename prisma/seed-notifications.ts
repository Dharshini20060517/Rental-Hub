 
import { db } from '../src/lib/db'

// Seed notifications for demo accounts (idempotent — clears first, then inserts).

async function main() {
  console.log('Seeding notifications…')
  await db.notification.deleteMany({})

  const owners = await db.user.findMany({ where: { role: 'owner' }, take: 3 })
  const customers = await db.user.findMany({ where: { role: 'customer' }, take: 3 })
  const admin = await db.user.findFirst({ where: { role: 'admin' } })

  const now = Date.now()
  const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000)

  // Owner notifications: new wishlist, new review, listing approved, maintenance reminder
  for (const o of owners) {
    const myEq = await db.equipment.findFirst({ where: { ownerId: o.id }, select: { id: true, title: true } })
    if (myEq) {
      await db.notification.create({ data: { userId: o.id, type: 'wishlist', title: 'New wishlist save', message: `Someone saved your "${myEq.title}" to their wishlist.`, data: { equipmentId: myEq.id }, isRead: false, createdAt: hoursAgo(2) } })
      await db.notification.create({ data: { userId: o.id, type: 'review', title: 'New 5-star review', message: `Your "${myEq.title}" received a new review.`, data: { equipmentId: myEq.id }, isRead: false, createdAt: hoursAgo(5) } })
      await db.notification.create({ data: { userId: o.id, type: 'listing', title: 'Listing approved', message: `"${myEq.title}" is now live and visible to customers.`, data: { equipmentId: myEq.id }, isRead: true, createdAt: hoursAgo(26) } })
      await db.notification.create({ data: { userId: o.id, type: 'maintenance', title: 'Maintenance due soon', message: `Scheduled maintenance window for "${myEq.title}" starts tomorrow.`, data: { equipmentId: myEq.id }, isRead: false, createdAt: hoursAgo(28) } })
    }
  }

  // Customer notifications: wishlist price drop, new listing in category
  for (const c of customers) {
    await db.notification.create({ data: { userId: c.id, type: 'price_drop', title: 'Price drop on a wishlisted item', message: 'An equipment on your wishlist just got more affordable. Check it out!', isRead: false, createdAt: hoursAgo(1) } })
    await db.notification.create({ data: { userId: c.id, type: 'new_listing', title: 'New equipment in your area', message: 'A new excavator was listed near you.', isRead: false, createdAt: hoursAgo(8) } })
    await db.notification.create({ data: { userId: c.id, type: 'welcome', title: 'Welcome to RentalHub!', message: 'Browse equipment, compare options, and save your favourites.', isRead: true, createdAt: hoursAgo(48) } })
  }

  // Admin notifications
  if (admin) {
    await db.notification.create({ data: { userId: admin.id, type: 'moderation', title: '3 listings awaiting moderation', message: 'Review new equipment submissions in the moderation queue.', isRead: false, createdAt: hoursAgo(3) } })
    await db.notification.create({ data: { userId: admin.id, type: 'user', title: 'New owner registered', message: 'A new business owner account is pending verification.', isRead: false, createdAt: hoursAgo(12) } })
    await db.notification.create({ data: { userId: admin.id, type: 'system', title: 'Weekly report ready', message: 'Platform analytics for this week are available.', isRead: true, createdAt: hoursAgo(30) } })
  }

  console.log(`Seeded ${await db.notification.count()} notifications ✅`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
