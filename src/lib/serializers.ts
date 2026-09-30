import { Prisma } from '@prisma/client'

export const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  accountType: true,
  businessName: true,
  registrationNumber: true,
  avatarUrl: true,
  phone: true,
  bio: true,
  isVerified: true,
  isSuspended: true,
  isOnboarded: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export type SafeUser = Prisma.UserGetPayload<{ select: typeof userSelect }>

export const equipmentInclude = {
  category: { select: { id: true, name: true, slug: true } },
  owner: { select: userSelect },
  images: { orderBy: { order: 'asc' } },
  specs: { orderBy: { order: 'asc' } },
  _count: { select: { reviews: true, wishlists: true } },
} satisfies Prisma.EquipmentInclude

export type EquipmentWithRelations = Prisma.EquipmentGetPayload<{ include: typeof equipmentInclude }>
