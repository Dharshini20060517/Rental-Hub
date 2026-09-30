'use client'

import { useState } from 'react'
import { MapPin, Heart, GitCompareArrows, BadgeCheck, ImageOff } from 'lucide-react'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns } from '@/lib/api-client'
import { formatCurrency, conditionLabel } from '@/lib/format'
import { RatingStars } from '@/components/shared/rating-stars'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type EquipmentListItem = {
  id: string
  title: string
  description: string
  categoryId: string
  status: string
  condition: string
  baseDailyPrice: number
  baseHourlyPrice: number | null
  baseDeposit: number
  city: string | null
  lat: number | null
  lng: number | null
  rating: number
  reviewCount: number
  wishlistCount: number
  distance?: number
  createdAt: string
  category: { id: string; name: string; slug: string }
  owner: { id: string; name: string | null; isVerified: boolean; avatarUrl: string | null; businessName: string | null }
  images: { id: string; url: string; isPrimary: boolean; order: number }[]
  specs: { id: string; key: string; value: string }[]
}

export function EquipmentCard({ item }: { item: EquipmentListItem }) {
  const navigate = useRouterStore((s) => s.navigate)
  const toggleCompare = useRouterStore((s) => s.toggleCompare)
  const compareIds = useRouterStore((s) => s.compareIds)
  const user = useAuthStore((s) => s.user)
  const [inWish, setInWish] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)

  const primary = item.images.find((i) => i.isPrimary) || item.images[0]
  const inCompare = compareIds.includes(item.id)

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

  function onCompare(e: React.MouseEvent) {
    e.stopPropagation()
    toggleCompare(item.id)
    toast.success(inCompare ? 'Removed from compare' : 'Added to compare')
  }

  return (
    <article
      onClick={() => navigate('equipment', { id: item.id })}
      className="group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 hover:ring-1 hover:ring-primary/20"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {primary ? (
           
          <img
            src={primary.url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="rounded-md bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur transition group-hover:bg-background/95">
            {conditionLabel(item.condition)}
          </span>
          {item.status !== 'active' && (
            <span className="rounded-md bg-amber-500/90 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
              {item.status}
            </span>
          )}
        </div>
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onClick={toggleWish}
            disabled={wishBusy}
            aria-label="Toggle wishlist"
            className="grid h-8 w-8 place-items-center rounded-full bg-background/85 backdrop-blur transition hover:bg-background hover:scale-110"
          >
            <Heart className={cn('h-4 w-4 transition', inWish ? 'fill-rose-500 text-rose-500 scale-110' : 'text-muted-foreground')} />
          </button>
          <button
            onClick={onCompare}
            aria-label="Toggle compare"
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full backdrop-blur transition hover:scale-110',
              inCompare ? 'bg-primary text-primary-foreground' : 'bg-background/85 hover:bg-background',
            )}
          >
            <GitCompareArrows className="h-4 w-4" />
          </button>
        </div>
        {/* Price badge on hover */}
        <div className="absolute bottom-2 left-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-lg">
            {formatCurrency(item.baseDailyPrice)}/day
          </span>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold leading-tight">{item.title}</h3>
          <RatingStars rating={item.rating} showValue={false} size={13} />
        </div>
        <p className="rh-line-clamp-2 text-xs text-muted-foreground">{item.description}</p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {item.city && <MapPin className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{item.city || 'Location on request'}</span>
          {item.distance !== undefined && (
            <span className="ml-auto shrink-0 font-medium text-foreground/70">{item.distance < 1 ? `${Math.round(item.distance * 1000)} m` : `${item.distance.toFixed(1)} km`}</span>
          )}
          {item.wishlistCount > 0 && (
            <span className={`flex shrink-0 items-center gap-0.5 text-rose-500 ${item.distance !== undefined ? 'ml-2' : 'ml-auto'}`}>
              <Heart className="h-3 w-3 fill-rose-500" />
              {item.wishlistCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {item.owner.avatarUrl ? (
             
            <img src={item.owner.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary ring-1 ring-primary/20">
              {(item.owner.name || item.owner.businessName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-xs font-medium">{item.owner.businessName || item.owner.name || 'Owner'}</span>
          {item.owner.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </div>

        <div className="flex items-end justify-between border-t pt-2.5">
          <div>
            <div className="text-lg font-bold tracking-tight text-primary">
              {formatCurrency(item.baseDailyPrice)}
              <span className="text-xs font-normal text-muted-foreground">/day</span>
            </div>
            <div className="text-[11px] text-muted-foreground">deposit {formatCurrency(item.baseDeposit)}</div>
          </div>
          <div className="text-right">
            <RatingStars rating={item.rating} size={11} showValue count={item.reviewCount} />
          </div>
        </div>
      </div>
    </article>
  )
}
