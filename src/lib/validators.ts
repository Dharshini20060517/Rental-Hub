import { z } from 'zod'

export const emailSchema = z.string().email('Invalid email address').max(254)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
export const nameSchema = z.string().min(1).max(80)
export const roleSchema = z.enum(['customer', 'owner', 'admin'])
export const accountTypeSchema = z.enum(['individual', 'business']).optional()

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema.default('customer'),
  accountType: accountTypeSchema,
  businessName: z.string().max(120).optional(),
  registrationNumber: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const resetRequestSchema = z.object({ email: emailSchema })
export const resetConfirmSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export const profileSchema = z.object({
  name: z.string().min(1).max(80).nullish(),
  phone: z.string().max(40).nullish(),
  bio: z.string().max(600).nullish(),
  accountType: accountTypeSchema,
  businessName: z.string().max(120).nullish(),
  registrationNumber: z.string().max(120).nullish(),
})

export const categorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase kebab-case'),
  description: z.string().max(400).nullish(),
  iconUrl: z.string().url().nullish(),
  parentId: z.string().cuid().nullish(),
})

// Pricing rule: { type, value, unit, start?, end? }
export const pricingRuleSchema = z
  .object({
    type: z.enum(['weekend_surcharge', 'long_discount', 'seasonal']),
    value: z.number(),
    unit: z.enum(['percent', 'amount']),
    minDays: z.number().int().positive().optional(),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    label: z.string().max(60).optional(),
  })
  .refine(
    (r) => r.type !== 'seasonal' || (!!r.start && !!r.end),
    { message: 'Seasonal rules require start and end', path: ['start'] },
  )

export const equipmentSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  categoryId: z.string().cuid(),
  status: z.enum(['draft', 'active', 'paused']).default('draft'),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).default('good'),
  baseDailyPrice: z.number().min(0),
  baseHourlyPrice: z.number().min(0).nullish(),
  baseDeposit: z.number().min(0).default(0),
  replacementValue: z.number().min(0).nullish(),
  pricingRules: z.array(pricingRuleSchema).max(8).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  city: z.string().max(120).nullish(),
  address: z.string().max(240).nullish(),
  bufferHours: z.number().int().min(0).max(72).default(0),
  purchaseDate: z.string().datetime().nullish(),
  conditionNotes: z.string().max(2000).nullish(),
  specs: z.array(z.object({ key: z.string().max(60), value: z.string().max(120) })).max(30).nullish(),
})

export const availabilityBlockSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.enum(['owner_blocked', 'maintenance', 'booked']).default('owner_blocked'),
})

export const maintenanceLogSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  cost: z.number().min(0).default(0),
  performedAt: z.string().datetime().nullish(),
})

export const maintenanceWindowSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().max(500).nullish(),
})

export const reviewSchema = z.object({
  receiverId: z.string().cuid(),
  equipmentId: z.string().cuid().nullish(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).nullish(),
  body: z.string().max(4000).nullish(),
})

export const userAdminUpdateSchema = z.object({
  role: roleSchema.optional(),
  isVerified: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
})
