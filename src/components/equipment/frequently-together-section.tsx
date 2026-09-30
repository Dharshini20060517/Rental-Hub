'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { apiFns } from '@/lib/api-client'
import { EquipmentCard, type EquipmentListItem } from '@/components/equipment/equipment-card'
import { Link2 } from 'lucide-react'

export function FrequentlyTogetherSection({ equipmentId }: { equipmentId: string }) {
  const { data, isLoading } = useQuery<EquipmentListItem[]>({
    queryKey: ['recommendations', 'frequently_together', equipmentId],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/intelligence/recommendations', { params: { type: 'frequently_together', id: equipmentId } })
      return (res.data.data || []) as EquipmentListItem[]
    },
    enabled: !!equipmentId,
  })

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Link2 className="h-5 w-5 text-primary" /> Frequently rented together
      </h2>
      <div className="grid grid-cols-1 gap-4 rh-stagger sm:grid-cols-2 lg:grid-cols-4">
        {(data || []).map((item) => (
          <EquipmentCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
