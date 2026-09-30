'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { useRouterStore } from '@/store/router'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { Sparkles } from 'lucide-react'

export function RecommendationWidget() {
  const navigate = useRouterStore((s) => s.navigate)
  const { data, isLoading } = useQuery<EquipmentListItem[]>({
    queryKey: ['recommendations', 'for_you'],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/intelligence/recommendations', { params: { type: 'for_you', limit: 4 } })
      return (res.data.data || []) as EquipmentListItem[]
    },
  })

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" /> Recommended for you
          </h2>
          <p className="text-sm text-muted-foreground">Smart picks based on your interests</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-4">
        {(data || []).map((item) => (
          <EquipmentCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
