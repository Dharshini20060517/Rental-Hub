'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns } from '@/lib/api-client'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { Heart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function WishlistView() {
  const navigate = useRouterStore((s) => s.navigate)
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery<{ rows: { id: string; equipmentId: string; equipment: EquipmentListItem }[] }>({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/wishlist', { params: { limit: 48 } })
      return { rows: (res.data.data || []) as { id: string; equipmentId: string; equipment: EquipmentListItem }[] }
    },
  })

  async function remove(equipmentId: string) {
    try {
      await apiFns.removeFromWishlist(equipmentId)
      qc.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success('Removed from wishlist')
    } catch {
      toast.error('Could not remove')
    }
  }

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><CardGridSkeleton count={6} /></div>

  const items = data?.rows || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Heart className="h-6 w-6 text-rose-500" /> Your wishlist</h1>
        <p className="text-sm text-muted-foreground">{items.length} saved {items.length === 1 ? 'item' : 'items'}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Tap the heart on any equipment to save it here for later."
          icon={Heart}
          action={<Button onClick={() => navigate('search')}>Browse equipment</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((w) => (
            <div key={w.id} className="relative">
              <EquipmentCard item={w.equipment} />
              <button
                onClick={(e) => { e.stopPropagation(); remove(w.equipmentId) }}
                className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/90 backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Remove from wishlist"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
