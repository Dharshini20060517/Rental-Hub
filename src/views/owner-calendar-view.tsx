'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useRouterStore } from '@/store/router'
import { useQuery } from '@tanstack/react-query'
import { apiFns } from '@/lib/api-client'
import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'

type Booking = { id: string; status: string; startDate: string; endDate: string; equipment: { id: string; title: string; images: { url: string; isPrimary: boolean }[] }; customer: { name: string } }

const STATUS_COLORS: Record<string, string> = {
  completed: 'oklch(0.65 0.18 142)',
  confirmed: 'oklch(0.48 0.12 162)',
  held: 'oklch(0.75 0.18 70)',
  in_use: 'oklch(0.5 0.2 264)',
  picked_up: 'oklch(0.6 0.18 184)',
  return_pending: 'oklch(0.75 0.18 70)',
  disputed: 'oklch(0.62 0.22 16)',
  late: 'oklch(0.62 0.22 16)',
  cancelled: 'oklch(0.5 0.02 250)',
}

export function OwnerCalendarView() {
  const navigate = useRouterStore((s) => s.navigate)

  const { data } = useQuery({
    queryKey: ['bookings', 'owner-calendar'],
    queryFn: () => apiFns.listBookings({ limit: 200 }),
  })

  const bookings = (data as unknown as Booking[]) || []

  const events = useMemo(() => {
    return bookings
      .filter(b => b.status !== 'cancelled')
      .map(b => ({
        id: b.id,
        title: `${b.equipment.title} — ${b.customer.name}`,
        start: b.startDate,
        end: new Date(new Date(b.endDate).getTime() + 86400000).toISOString(),
        color: STATUS_COLORS[b.status] || 'oklch(0.48 0.12 162)',
      }))
  }, [bookings])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('owner-bookings')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to bookings
      </button>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Master calendar</h1>
      <p className="mb-6 text-sm text-muted-foreground">All your equipment bookings across all listings</p>

      <div className="rounded-xl border bg-card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height={600}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={events}
          dayMaxEvents={4}
          eventClick={(info) => navigate('booking-detail', { id: info.event.id })}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        {Object.entries({ Confirmed: 'oklch(0.48 0.12 162)', 'In use': 'oklch(0.5 0.2 264)', Completed: 'oklch(0.65 0.18 142)', Held: 'oklch(0.75 0.18 70)', Disputed: 'oklch(0.62 0.22 16)' }).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: color }} /> {label}</span>
        ))}
      </div>
    </div>
  )
}
