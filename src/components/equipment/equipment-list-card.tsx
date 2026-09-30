'use client'

import { MapPin, Heart, BadgeCheck, ImageOff } from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns } from '@/lib/api-client'
import { formatCurrency, conditionLabel } from '@/lib/format'
import { RatingStars } from '@/components/shared/rating-stars'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useState } from 'react'

type EquipmentListCardItem = {
  id: string
  title: string
  description: string
  status: string
  condition: string
  baseDailyPrice: number
  baseDeposit: number
  city: string | null
  rating: number
  reviewCount: number
  distance?: number
  category: { name: string }
  owner: { name: string | null; businessName: string | null; isVerified: boolean; avatarUrl: string | null }
  images: { id: string; url: string; isPrimary: boolean; order: number }[]
  specs: { id: string; key: string; value: string }[]
}

export function EquipmentListCard({ item }: { item: EquipmentListCardItem }) {
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const [inWish, setInWish] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)
  const primary = item.images.find((i) => i.isPrimary) || item.images[0]

  async function toggleWish(e: React.MouseEvent) {
    e.stopPropagation()
    if (!user) {
      toast.info('Please log in to save to wishlist')
      navigate('login', { redirect: 'equipment', id: item.id })
      return
    }
    setWishBusy(true)
    try {
      const res = await apiFns.toggleWishlist(item.id)
      setInWish(res.inWishlist)
      toast.success(res.inWishlist ? 'Added to wishlist' : 'Removed from wishlist')
    } catch {
      toast.error('Could not update wishlist')
    } finally {
      setWishBusy(false)
    }
  }

  return (
    <article
      onClick={() => navigate('equipment', { id: item.id })}
      className="group flex cursor-pointer overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/40"
    >
      {/* Image */}
      <div className="relative aspect-square w-32 shrink-0 overflow-hidden bg-muted sm:w-40">
        {primary ? (
           
          <img src={primary.url} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-6 w-6" /></div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
          {conditionLabel(item.condition)}
        </span>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-sm font-semibold leading-tight">{item.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.category.name}</p>
          </div>
          <button
            onClick={toggleWish}
            disabled={wishBusy}
            aria-label="Toggle wishlist"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted/50 transition hover:bg-muted hover:scale-110"
          >
            <Heart className={cn('h-3.5 w-3.5 transition', inWish ? 'fill-rose-500 text-rose-500 scale-110' : 'text-muted-foreground')} />
          </button>
        </div>

        <p className="rh-line-clamp-2 mt-1 text-xs text-muted-foreground">{item.description}</p>

        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {item.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{item.city}</span>}
          {item.distance !== undefined && (
            <span className="font-medium text-foreground/70">{item.distance < 1 ? `${Math.round(item.distance * 1000)} m` : `${item.distance.toFixed(1)} km`}</span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            {item.owner.avatarUrl ? (
               
              <img src={item.owner.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover ring-1 ring-border" />
            ) : (
              <div className="grid h-4 w-4 place-items-center rounded-full bg-primary/15 text-[8px] font-bold text-primary">
                {(item.owner.name || item.owner.businessName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate text-[11px] font-medium">{item.owner.businessName || item.owner.name || 'Owner'}</span>
            {item.owner.isVerified && <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />}
          </div>
          <div className="flex items-center gap-2">
            <RatingStars rating={item.rating} size={10} showValue={false} />
            <span className="text-sm font-bold text-primary">{formatCurrency(item.baseDailyPrice)}<span className="text-[10px] font-normal text-muted-foreground">/day</span></span>
          </div>
        </div>
      </div>
    </article>
  )
}
