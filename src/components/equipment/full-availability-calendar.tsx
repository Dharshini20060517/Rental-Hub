'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useRouterStore } from '@/store/router'
import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { useMemo } from 'react'
import { formatDate } from '@/lib/format'

type Block = { id: string; startDate: string; endDate: string; reason: string }
type Booking = { id: string; status: string; startDate: string; endDate: string; equipment: { id: string; title: string } }

const REASON_COLORS: Record<string, string> = {
  booked: 'oklch(0.65 0.18 142)',
  owner_blocked: 'oklch(0.75 0.18 70)',
  maintenance: 'oklch(0.6 0.18 184)',
}

export function FullAvailabilityCalendar({ equipmentId }: { equipmentId: string }) {
  const navigate = useRouterStore((s) => s.navigate)

  const { data: blocks } = useQuery({ queryKey: ['availability', equipmentId], queryFn: () => apiFns.listAvailability(equipmentId) })
  const { data: bookings } = useQuery({
    queryKey: ['bookings-for-equipment', equipmentId],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/bookings', { params: { limit: 100 } })
      return (res.data.data || []).filter((b: { equipment: { id: string } }) => b.equipment.id === equipmentId)
    },
    enabled: !!equipmentId,
  })

  const events = useMemo(() => {
    const evs: { id: string; title: string; start: string; end: string; color: string; display: string }[] = []
    const blockList = (blocks as Block[]) || []
    const bookingList = (bookings as Booking[]) || []

    for (const b of blockList) {
      evs.push({
        id: b.id,
        title: b.reason === 'maintenance' ? 'Maintenance' : b.reason === 'owner_blocked' ? 'Blocked' : 'Booked',
        start: b.startDate,
        end: new Date(new Date(b.endDate).getTime() + 86400000).toISOString(),
        color: REASON_COLORS[b.reason] || 'oklch(0.6 0.02 250)',
        display: 'background',
      })
    }

    for (const b of bookingList) {
      if (b.status === 'cancelled') continue
      evs.push({
        id: b.id,
        title: b.equipment.title,
        start: b.startDate,
        end: new Date(new Date(b.endDate).getTime() + 86400000).toISOString(),
        color: b.status === 'completed' ? 'oklch(0.65 0.18 142)' : 'oklch(0.48 0.12 162)',
        display: 'auto',
      })
    }

    return evs
  }, [blocks, bookings])

  function handleDateSelect(selectInfo: { startStr: string; endStr: string }) {
    const start = selectInfo.startStr
    const end = new Date(new Date(selectInfo.endStr).getTime() - 86400000).toISOString()
    navigate('checkout', { equipmentId, startDate: start, endDate: end })
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        height={400}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        events={events}
        selectable
        select={handleDateSelect}
        selectAllow={(selectInfo) => selectInfo.start > new Date()}
        dayMaxEvents={3}
        eventClick={(info) => {
          if (info.event.display !== 'background') navigate('booking-detail', { id: info.event.id })
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'oklch(0.48 0.12 162)' }} /> Booked</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'oklch(0.75 0.18 70)' }} /> Owner blocked</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'oklch(0.6 0.18 184)' }} /> Maintenance</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" /> Completed</span>
        <p className="w-full text-muted-foreground/70">Click and drag on available dates to start a booking</p>
      </div>
    </div>
  )
}
