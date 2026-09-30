'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AvailabilityBlock = {
  id: string
  startDate: string
  endDate: string
  reason: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const REASON_STYLES: Record<string, { bg: string; label: string; text: string }> = {
  owner_blocked: { bg: 'bg-amber-500/20', label: 'Owner blocked', text: 'text-amber-700 dark:text-amber-400' },
  maintenance: { bg: 'bg-sky-500/20', label: 'Maintenance', text: 'text-sky-700 dark:text-sky-400' },
  booked: { bg: 'bg-rose-500/20', label: 'Booked', text: 'text-rose-700 dark:text-rose-400' },
}

export function AvailabilityCalendar({ blocks }: { blocks: AvailabilityBlock[] }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const calendar = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: { date: Date | null; status: 'available' | 'blocked' | 'past'; reason?: string }[] = []
    for (let i = 0; i < startOffset; i++) days.push({ date: null, status: 'available' })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
      let status: 'available' | 'blocked' | 'past' = isPast ? 'past' : 'available'
      let reason: string | undefined
      for (const block of blocks) {
        const start = new Date(block.startDate)
        const end = new Date(block.endDate)
        if (date >= start && date <= end) {
          status = 'blocked'
          reason = block.reason
          break
        }
      }
      days.push({ date, status, reason })
    }
    return days
  }, [viewDate, blocks])

  function prevMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }
  function goToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const hasBlocks = blocks.length > 0
  const blockedCount = calendar.filter((d) => d.status === 'blocked').length

  return (
    <div className="rounded-xl border bg-card p-4">
      {/* Calendar header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </h3>
          <p className="text-xs text-muted-foreground">
            {blockedCount > 0 ? `${blockedCount} day${blockedCount > 1 ? 's' : ''} blocked this month` : 'All days available'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={goToday}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday headers */}
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {/* Days */}
        {calendar.map((day, i) => {
          if (!day.date) return <div key={i} className="aspect-square" />
          const dayNum = day.date.getDate()
          const isToday = day.date.toDateString() === today.toDateString()
          const reasonStyle = day.reason ? REASON_STYLES[day.reason] : null
          return (
            <div
              key={i}
              className={cn(
                'relative aspect-square rounded-lg border text-center text-sm transition',
                day.status === 'past' && 'border-transparent text-muted-foreground/30',
                day.status === 'available' && !isToday && 'border-transparent hover:bg-primary/5',
                day.status === 'blocked' && reasonStyle && `${reasonStyle.bg} border-transparent`,
                isToday && 'border-primary ring-1 ring-primary/30',
              )}
              title={day.status === 'blocked' && day.reason ? REASON_STYLES[day.reason]?.label : undefined}
            >
              <span className={cn(
                'absolute inset-0 grid place-items-center',
                day.status === 'past' && 'text-muted-foreground/30',
                day.status === 'blocked' && reasonStyle && reasonStyle.text,
              )}>
                {dayNum}
              </span>
              {day.status === 'blocked' && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current opacity-60" />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
        <span className="flex items-center gap-1.5 text-xs">
          <span className="h-3 w-3 rounded border border-primary/30" />
          Available
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="h-3 w-3 rounded bg-amber-500/20" />
          Owner blocked
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="h-3 w-3 rounded bg-sky-500/20" />
          Maintenance
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="h-3 w-3 rounded bg-rose-500/20" />
          Booked
        </span>
      </div>

      {!hasBlocks && (
        <p className="mt-3 text-xs text-muted-foreground">
          This equipment has no availability blocks — it's available for booking requests on any future date.
        </p>
      )}
    </div>
  )
}
