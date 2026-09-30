 
import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'

// RentalHub seed: 3 roles (admin seeded), 8+ categories, 30+ listings across cities,
// sample reviews, maintenance logs, availability blocks, audit logs. Idempotent.

const PICSUM = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`

// Equipment image mapping — each listing gets a category-specific generated image
// Falls back to picsum if the generated image doesn't exist yet
const EQUIPMENT_IMAGES: Record<string, string> = {
  'Bosch GSB 550W Impact Drill': '/uploads/equipment/bosch_drill.png',
  'DeWalt 20V Cordless Drill Kit': '/uploads/equipment/dewalt_cordless.png',
  'Makita Circular Saw 1200W': '/uploads/equipment/makita_saw.png',
  'Angle Grinder 4-inch 850W': '/uploads/equipment/angle_grinder.png',
  'Milwaukee M18 Rotary Hammer': '/uploads/equipment/milwaukee_hammer.png',
  'Orbital Sander 220V': '/uploads/equipment/orbital_sander.png',
  'Professional Pipe Wrench Set': '/uploads/equipment/pipe_wrench.png',
  'Cordless Impact Driver Kit': '/uploads/equipment/impact_driver.png',
  'Concrete Mixer 350L': '/uploads/equipment/concrete_mixer.png',
  'Needle Vibrator for Concrete': '/uploads/equipment/needle_vibrator.png',
  'Scaffolding Tower 6m': '/uploads/equipment/scaffolding.png',
  'Bar Bending Machine': '/uploads/equipment/bar_bending.png',
  'Mini Excavator 1.5 Ton': '/uploads/equipment/mini_excavator.png',
  'Backhoe Loader JCB 3DX': '/uploads/equipment/backhoe_loader.png',
  'Plate Compactor 450kg': '/uploads/equipment/plate_compactor.png',
  'Soil Vibratory Roller': '/uploads/equipment/vibratory_roller.png',
  'Tata Pickup Truck 1 Ton': '/uploads/equipment/tata_pickup.png',
  'Cargo Van 14ft': '/uploads/equipment/cargo_van.png',
  'Mini Tipper 3 Wheeler': '/uploads/equipment/mini_tipper.png',
  'JBL EON 715 PA System': '/uploads/equipment/jbl_speaker.png',
  'Epson 1080p Projector': '/uploads/equipment/epson_projector.png',
  'Wireless Microphone Set (4 mics)': '/uploads/equipment/wireless_mics.png',
  'Stage Lighting Truss Kit': '/uploads/equipment/stage_lighting.png',
  '20x40 Event Tent': '/uploads/equipment/event_tent.png',
  'Banquet Round Tables (x20)': '/uploads/equipment/banquet_tables.png',
  'Folding Chairs (x100)': '/uploads/equipment/folding_chairs.png',
  'Inflatable Bouncy Castle': '/uploads/equipment/bouncy_castle.png',
  '4-Person Dome Tent': '/uploads/equipment/dome_tent.png',
  'Trekking Backpack 60L': '/uploads/equipment/trekking_backpack.png',
  'Camping Stove + Cookset': '/uploads/equipment/camping_stove.png',
  'Sony A7III Mirrorless Camera': '/uploads/equipment/sony_camera.png',
  'Sigma 70-200 f/2.8 Lens': '/uploads/equipment/sigma_lens.png',
  'Karcher K7 Pressure Washer': '/uploads/equipment/pressure_washer.png',
  'Industrial Wet/Dry Vacuum 30L': '/uploads/equipment/wet_dry_vacuum.png',
}

function getImageUrl(title: string, fallbackSeed: string): string {
  return EQUIPMENT_IMAGES[title] || PICSUM(fallbackSeed)
}

const cities = [
  { city: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { city: 'Delhi', lat: 28.6139, lng: 77.209 },
  { city: 'Pune', lat: 18.5204, lng: 73.8567 },
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { city: 'New York', lat: 40.7128, lng: -74.006 },
]

const categories = [
  { name: 'Power Tools', slug: 'power-tools', description: 'Drills, saws, sanders and rotary power tools.' },
  { name: 'Hand Tools', slug: 'hand-tools', description: 'Manual tools for construction and repair.' },
  { name: 'Construction', slug: 'construction', description: 'Mixers, vibrators, scaffolding and formwork.' },
  { name: 'Earthmoving', slug: 'earthmoving', description: 'Excavators, loaders and compactors.' },
  { name: 'Vehicles', slug: 'vehicles', description: 'Pickups, vans and cargo transport.' },
  { name: 'Audio & Video', slug: 'audio-video', description: 'PA systems, projectors, speakers and lighting.' },
  { name: 'Party & Events', slug: 'party-events', description: 'Tents, tables, chairs and decoration.' },
  { name: 'Camping & Outdoor', slug: 'camping-outdoor', description: 'Tents, trekking and outdoor gear.' },
  { name: 'Photography', slug: 'photography', description: 'Cameras, lenses, lighting and tripods.' },
  { name: 'Cleaning', slug: 'cleaning', description: 'Pressure washers, vacuums and floor care.' },
]

type ListingSeed = {
  title: string
  categorySlug: string
  daily: number
  hourly?: number
  deposit: number
  replacement?: number
  condition: string
  cityIndex: number
  specs: { key: string; value: string }[]
  pricing: { type: string; value: number; unit: string; minDays?: number; label?: string }[]
  status?: string
}

const listings: ListingSeed[] = [
  { title: 'Bosch GSB 550W Impact Drill', categorySlug: 'power-tools', daily: 250, hourly: 40, deposit: 500, replacement: 4500, condition: 'like_new', cityIndex: 0, specs: [{ key: 'Power', value: '550W' }, { key: 'Chuck', value: '13mm' }, { key: 'Weight', value: '1.8 kg' }], pricing: [{ type: 'weekend_surcharge', value: 15, unit: 'percent' }, { type: 'long_discount', value: 10, unit: 'percent', minDays: 7, label: '7+ days -10%' }] },
  { title: 'DeWalt 20V Cordless Drill Kit', categorySlug: 'power-tools', daily: 300, hourly: 50, deposit: 700, replacement: 6500, condition: 'new', cityIndex: 1, specs: [{ key: 'Battery', value: '20V Li-ion' }, { key: 'Torque', value: '65 Nm' }], pricing: [{ type: 'weekend_surcharge', value: 20, unit: 'percent' }] },
  { title: 'Makita Circular Saw 1200W', categorySlug: 'power-tools', daily: 280, deposit: 600, replacement: 6000, condition: 'good', cityIndex: 2, specs: [{ key: 'Blade', value: '185mm' }, { key: 'Power', value: '1200W' }], pricing: [] },
  { title: 'Angle Grinder 4-inch 850W', categorySlug: 'power-tools', daily: 150, hourly: 25, deposit: 300, replacement: 2500, condition: 'fair', cityIndex: 3, specs: [{ key: 'Disc', value: '100mm' }], pricing: [] },
  { title: 'Milwaukee M18 Rotary Hammer', categorySlug: 'power-tools', daily: 350, deposit: 800, replacement: 12000, condition: 'new', cityIndex: 7, specs: [{ key: 'Mode', value: 'Rotary+Hammer' }], pricing: [{ type: 'long_discount', value: 15, unit: 'percent', minDays: 5 }] },
  { title: 'Orbital Sander 220V', categorySlug: 'power-tools', daily: 120, deposit: 250, replacement: 2000, condition: 'good', cityIndex: 4, specs: [{ key: 'Pad', value: '125mm' }], pricing: [] },
  { title: 'Professional Pipe Wrench Set', categorySlug: 'hand-tools', daily: 80, deposit: 200, replacement: 1200, condition: 'good', cityIndex: 5, specs: [{ key: 'Sizes', value: '8"-24"' }], pricing: [] },
  { title: 'Cordless Impact Driver Kit', categorySlug: 'hand-tools', daily: 220, deposit: 500, replacement: 5000, condition: 'like_new', cityIndex: 0, specs: [{ key: 'Torque', value: '180 Nm' }], pricing: [] },
  { title: 'Concrete Mixer 350L', categorySlug: 'construction', daily: 600, deposit: 2000, replacement: 28000, condition: 'good', cityIndex: 1, specs: [{ key: 'Drum', value: '350L' }, { key: 'Motor', value: '1.5HP' }], pricing: [{ type: 'weekend_surcharge', value: 10, unit: 'percent' }, { type: 'long_discount', value: 12, unit: 'percent', minDays: 10 }] },
  { title: 'Needle Vibrator for Concrete', categorySlug: 'construction', daily: 350, deposit: 1000, replacement: 15000, condition: 'good', cityIndex: 2, specs: [{ key: 'Needle', value: '60mm' }], pricing: [] },
  { title: 'Scaffolding Tower 6m', categorySlug: 'construction', daily: 450, deposit: 1500, replacement: 22000, condition: 'good', cityIndex: 3, specs: [{ key: 'Height', value: '6m' }, { key: 'Load', value: '200 kg' }], pricing: [] },
  { title: 'Bar Bending Machine', categorySlug: 'construction', daily: 800, deposit: 3000, replacement: 45000, condition: 'fair', cityIndex: 4, specs: [{ key: 'Bar Dia', value: '8-32mm' }], pricing: [{ type: 'long_discount', value: 20, unit: 'percent', minDays: 7 }] },
  { title: 'Mini Excavator 1.5 Ton', categorySlug: 'earthmoving', daily: 3500, deposit: 15000, replacement: 850000, condition: 'good', cityIndex: 5, specs: [{ key: 'Dig Depth', value: '2.2m' }, { key: 'Weight', value: '1.5T' }], pricing: [{ type: 'weekend_surcharge', value: 25, unit: 'percent' }, { type: 'long_discount', value: 18, unit: 'percent', minDays: 7, label: 'Weekly -18%' }] },
  { title: 'Backhoe Loader JCB 3DX', categorySlug: 'earthmoving', daily: 6500, deposit: 25000, replacement: 1800000, condition: 'good', cityIndex: 6, specs: [{ key: 'Bucket', value: '1 cum' }], pricing: [{ type: 'long_discount', value: 25, unit: 'percent', minDays: 14 }] },
  { title: 'Plate Compactor 450kg', categorySlug: 'earthmoving', daily: 900, deposit: 4000, replacement: 65000, condition: 'like_new', cityIndex: 7, specs: [{ key: 'Plate', value: '550x420mm' }], pricing: [] },
  { title: 'Soil Vibratory Roller', categorySlug: 'earthmoving', daily: 2200, deposit: 10000, replacement: 320000, condition: 'good', cityIndex: 0, specs: [{ key: 'Drum', value: '800mm' }], pricing: [] },
  { title: 'Tata Pickup Truck 1 Ton', categorySlug: 'vehicles', daily: 1500, deposit: 8000, replacement: 450000, condition: 'good', cityIndex: 1, specs: [{ key: 'Payload', value: '1000 kg' }], pricing: [{ type: 'weekend_surcharge', value: 15, unit: 'percent' }, { type: 'long_discount', value: 15, unit: 'percent', minDays: 5 }] },
  { title: 'Cargo Van 14ft', categorySlug: 'vehicles', daily: 2200, deposit: 12000, replacement: 700000, condition: 'good', cityIndex: 2, specs: [{ key: 'Volume', value: '14ft' }], pricing: [] },
  { title: 'Mini Tipper 3 Wheeler', categorySlug: 'vehicles', daily: 1200, deposit: 6000, replacement: 350000, condition: 'fair', cityIndex: 3, specs: [{ key: 'Payload', value: '500 kg' }], pricing: [] },
  { title: 'JBL EON 715 PA System', categorySlug: 'audio-video', daily: 1800, deposit: 6000, replacement: 120000, condition: 'like_new', cityIndex: 4, specs: [{ key: 'Output', value: '650W' }, { key: 'Speakers', value: '2x15"' }], pricing: [{ type: 'weekend_surcharge', value: 20, unit: 'percent' }] },
  { title: 'Epson 1080p Projector', categorySlug: 'audio-video', daily: 800, deposit: 4000, replacement: 70000, condition: 'good', cityIndex: 5, specs: [{ key: 'Resolution', value: '1080p' }, { key: 'Lumens', value: '3500' }], pricing: [] },
  { title: 'Wireless Microphone Set (4 mics)', categorySlug: 'audio-video', daily: 600, deposit: 2000, replacement: 25000, condition: 'good', cityIndex: 6, specs: [{ key: 'Mics', value: '4' }, { key: 'Range', value: '50m' }], pricing: [] },
  { title: 'Stage Lighting Truss Kit', categorySlug: 'audio-video', daily: 1400, deposit: 5000, replacement: 90000, condition: 'good', cityIndex: 7, specs: [{ key: 'Span', value: '6m' }], pricing: [] },
  { title: '20x40 Event Tent', categorySlug: 'party-events', daily: 3500, deposit: 15000, replacement: 250000, condition: 'good', cityIndex: 0, specs: [{ key: 'Area', value: '800 sqft' }, { key: 'Capacity', value: '150' }], pricing: [{ type: 'weekend_surcharge', value: 30, unit: 'percent', label: 'Weekend +30%' }] },
  { title: 'Banquet Round Tables (x20)', categorySlug: 'party-events', daily: 900, deposit: 4000, replacement: 60000, condition: 'good', cityIndex: 1, specs: [{ key: 'Qty', value: '20' }, { key: 'Diameter', value: '5ft' }], pricing: [] },
  { title: 'Folding Chairs (x100)', categorySlug: 'party-events', daily: 700, deposit: 3000, replacement: 40000, condition: 'good', cityIndex: 2, specs: [{ key: 'Qty', value: '100' }], pricing: [] },
  { title: 'Inflatable Bouncy Castle', categorySlug: 'party-events', daily: 2500, deposit: 10000, replacement: 150000, condition: 'like_new', cityIndex: 3, specs: [{ key: 'Size', value: '4x4m' }], pricing: [{ type: 'weekend_surcharge', value: 25, unit: 'percent' }] },
  { title: '4-Person Dome Tent', categorySlug: 'camping-outdoor', daily: 400, deposit: 1500, replacement: 18000, condition: 'good', cityIndex: 4, specs: [{ key: 'Capacity', value: '4' }, { key: 'Season', value: '3' }], pricing: [{ type: 'long_discount', value: 20, unit: 'percent', minDays: 3 }] },
  { title: 'Trekking Backpack 60L', categorySlug: 'camping-outdoor', daily: 200, deposit: 800, replacement: 6000, condition: 'good', cityIndex: 5, specs: [{ key: 'Volume', value: '60L' }], pricing: [] },
  { title: 'Camping Stove + Cookset', categorySlug: 'camping-outdoor', daily: 150, deposit: 600, replacement: 4500, condition: 'good', cityIndex: 6, specs: [{ key: 'Burners', value: '2' }], pricing: [] },
  { title: 'Sony A7III Mirrorless Camera', categorySlug: 'photography', daily: 2500, deposit: 15000, replacement: 180000, condition: 'like_new', cityIndex: 7, specs: [{ key: 'Sensor', value: '24MP FF' }, { key: 'Video', value: '4K' }], pricing: [{ type: 'weekend_surcharge', value: 15, unit: 'percent' }, { type: 'long_discount', value: 25, unit: 'percent', minDays: 5 }] },
  { title: 'Sigma 70-200 f/2.8 Lens', categorySlug: 'photography', daily: 1800, deposit: 10000, replacement: 130000, condition: 'good', cityIndex: 0, specs: [{ key: 'Focal', value: '70-200mm' }, { key: 'Aperture', value: 'f/2.8' }], pricing: [] },
  { title: 'Karcher K7 Pressure Washer', categorySlug: 'cleaning', daily: 500, deposit: 2000, replacement: 28000, condition: 'good', cityIndex: 1, specs: [{ key: 'Pressure', value: '180 bar' }], pricing: [] },
  { title: 'Industrial Wet/Dry Vacuum 30L', categorySlug: 'cleaning', daily: 350, deposit: 1500, replacement: 18000, condition: 'good', cityIndex: 2, specs: [{ key: 'Tank', value: '30L' }], pricing: [] },
]

function descFor(title: string, cat: string): string {
  return `${title} — well maintained ${cat.toLowerCase()} available for rent. Inspected and serviced before every rental. Pickup and delivery options available. Suitable for both short-term and long-term rentals with flexible dynamic pricing.`
}

async function main() {
  console.log('Resetting data…')
  // Wipe in dependency order
  await db.auditLog.deleteMany({})
  await db.notification.deleteMany({})
  await db.review.deleteMany({})
  await db.wishlist.deleteMany({})
  await db.maintenanceWindow.deleteMany({})
  await db.maintenanceLog.deleteMany({})
  await db.availabilityBlock.deleteMany({})
  await db.bookingStatusHistory.deleteMany({})
  await db.payment.deleteMany({})
  await db.bookingMessage.deleteMany({})
  await db.disputeMessage.deleteMany({})
  await db.dispute.deleteMany({})
  await db.damageComparison.deleteMany({})
  await db.waitlist.deleteMany({})
  await db.bundleItem.deleteMany({})
  await db.bundle.deleteMany({})
  await db.priceSuggestion.deleteMany({})
  await db.notification.deleteMany({})
  await db.auditLog.deleteMany({})
  await db.booking.deleteMany({})
  await db.equipmentSpec.deleteMany({})
  await db.equipmentImage.deleteMany({})
  await db.equipment.deleteMany({})
  await db.category.deleteMany({})
  await db.user.deleteMany({})

  console.log('Creating users…')
  const admin = await db.user.create({
    data: {
      email: 'admin@rentalhub.test',
      name: 'Platform Admin',
      passwordHash: await hashPassword('Admin123!'),
      role: 'admin',
      isVerified: true,
      isOnboarded: true,
    },
  })

  const ownerData = [
    { email: 'rohit@rentalhub.test', name: 'Rohit Sharma', accountType: 'business', businessName: 'Sharma Equip Co.', registrationNumber: 'SEC-2024-001', city: cities[0] },
    { email: 'anita@rentalhub.test', name: 'Anita Verma', accountType: 'business', businessName: 'Verma Rentals LLP', registrationNumber: 'VR-2023-118', city: cities[1] },
    { email: 'karan@rentalhub.test', name: 'Karan Mehta', accountType: 'individual', city: cities[2] },
    { email: 'priya@rentalhub.test', name: 'Priya Nair', accountType: 'business', businessName: 'Nair Party Solutions', registrationNumber: 'NPS-2022-045', city: cities[3] },
    { email: 'sam@rentalhub.test', name: 'Sam Carter', accountType: 'individual', city: cities[7] },
  ]
  const owners = []
  for (const o of ownerData) {
    owners.push(
      await db.user.create({
        data: {
          email: o.email,
          name: o.name,
          passwordHash: await hashPassword('Owner123!'),
          role: 'owner',
          accountType: o.accountType,
          businessName: o.businessName ?? null,
          registrationNumber: o.registrationNumber ?? null,
          phone: '+91 90000 00000',
          avatarUrl: PICSUM('avatar-' + o.email, 200, 200),
          isVerified: true,
          isOnboarded: true,
        },
      }),
    )
  }

  const customerData = [
    { email: 'rahul@rentalhub.test', name: 'Rahul Das' },
    { email: 'meena@rentalhub.test', name: 'Meena Iyer' },
    { email: 'joe@rentalhub.test', name: 'Joe Walker' },
    { email: 'fatima@rentalhub.test', name: 'Fatima Khan' },
    { email: 'arjun@rentalhub.test', name: 'Arjun Reddy' },
  ]
  const customers = []
  for (const c of customerData) {
    customers.push(
      await db.user.create({
        data: {
          email: c.email,
          name: c.name,
          passwordHash: await hashPassword('Customer123!'),
          role: 'customer',
          avatarUrl: PICSUM('avatar-' + c.email, 200, 200),
        },
      }),
    )
  }

  console.log('Creating categories…')
  const catMap = new Map<string, { id: string }>()
  for (const c of categories) {
    const created = await db.category.create({ data: { name: c.name, slug: c.slug, description: c.description } })
    catMap.set(c.slug, created)
  }

  console.log('Creating equipment listings…')
  let idx = 0
  for (const l of listings) {
    const owner = owners[idx % owners.length]
    const cat = catMap.get(l.categorySlug)!
    const city = cities[l.cityIndex]
    const seed = `${l.title}-${idx}`
    const status = l.status ?? (idx % 7 === 0 ? 'draft' : idx % 11 === 0 ? 'paused' : 'active')
    const eq = await db.equipment.create({
      data: {
        title: l.title,
        description: descFor(l.title, l.categorySlug.replace('-', ' ')),
        categoryId: cat.id,
        ownerId: owner.id,
        status,
        condition: l.condition,
        baseDailyPrice: l.daily,
        baseHourlyPrice: l.hourly ?? null,
        baseDeposit: l.deposit,
        replacementValue: l.replacement ?? null,
        pricingRules: l.pricing.length ? l.pricing : null,
        lat: city.lat,
        lng: city.lng,
        city: city.city,
        address: `${city.city}`,
        bufferHours: idx % 3 === 0 ? 2 : 0,
        conditionNotes: 'Serviced per rental cycle. Wear parts replaced quarterly.',
        images: {
          create: [
            { url: getImageUrl(l.title, seed), isPrimary: true, order: 0 },
            { url: getImageUrl(l.title, seed + '-2'), order: 1 },
            { url: getImageUrl(l.title, seed + '-3'), order: 2 },
          ],
        },
        specs: { create: l.specs.map((s, i) => ({ ...s, order: i })) },
      },
    })
    idx += 1
    // maintenance log for ~half
    if (idx % 2 === 0) {
      await db.maintenanceLog.create({
        data: {
          equipmentId: eq.id,
          ownerId: owner.id,
          title: 'Quarterly service',
          description: 'Replaced worn brushes, lubricated gears, safety check passed.',
          cost: 350 + (idx % 5) * 100,
        },
      })
    }
    // maintenance window for some
    if (idx % 5 === 0) {
      const start = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      const end = new Date(start.getTime() + 1000 * 60 * 60 * 24)
      await db.maintenanceWindow.create({
        data: { equipmentId: eq.id, ownerId: owner.id, startDate: start, endDate: end, notes: 'Scheduled calibration.' },
      })
    }
    // availability block for some (owner-blocked)
    if (idx % 6 === 0) {
      const start = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
      const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 2)
      await db.availabilityBlock.create({
        data: { equipmentId: eq.id, ownerId: owner.id, startDate: start, endDate: end, reason: 'owner_blocked' },
      })
    }
  }

  console.log('Creating reviews…')
  const activeEquipment = await db.equipment.findMany({ where: { status: 'active' }, take: 12 })
  let rIdx = 0
  for (const eq of activeEquipment) {
    const reviewer = customers[rIdx % customers.length]
    await db.review.create({
      data: {
        reviewerId: reviewer.id,
        receiverId: eq.ownerId,
        equipmentId: eq.id,
        rating: 3 + ((rIdx % 3)), // 3-5
        title: ['Great experience', 'Solid equipment', 'Would rent again', 'Reliable owner'][rIdx % 4],
        body: 'Equipment was in good condition and the owner was responsive. Pickup was smooth. Would recommend for similar projects.',
      },
    })
    rIdx += 1
  }

  console.log('Creating wishlists…')
  for (let i = 0; i < 8; i++) {
    const cust = customers[i % customers.length]
    const eq = activeEquipment[i % activeEquipment.length]
    await db.wishlist
      .create({ data: { userId: cust.id, equipmentId: eq.id } })
      .catch(() => {})
  }

  console.log('Creating audit logs…')
  await db.auditLog.create({
    data: { actorId: admin.id, action: 'SEED_RUN', resource: 'system', metadata: { at: new Date().toISOString() } },
  })
  await db.auditLog.create({
    data: { actorId: owners[0].id, action: 'LISTING_CREATED', resource: 'equipment', metadata: { count: listings.length } },
  })

  console.log('Seed complete ✅')
  console.log('--- Demo accounts ---')
  console.log('Admin    : admin@rentalhub.test / Admin123!')
  console.log('Owner    : rohit@rentalhub.test / Owner123!')
  console.log('Customer : rahul@rentalhub.test / Customer123!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
