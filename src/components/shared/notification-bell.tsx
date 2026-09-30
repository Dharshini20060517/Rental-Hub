'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { apiFns, type ApiError } from '@/lib/api-client'
import { useRouterStore } from '@/store/router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  data: unknown
}

const ICONS: Record<string, string> = {
  wishlist: '❤️',
  review: '⭐',
  listing: '📦',
  maintenance: '🔧',
  price_drop: '💸',
  new_listing: '🆕',
  welcome: '👋',
  moderation: '📋',
  user: '👤',
  system: '⚙️',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useRouterStore((s) => s.navigate)

  const { data } = useQuery<{ rows: Notification[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/notifications', { params: { limit: 15 } })
      const unreadCount = Number(res.headers['x-unread-count'] || 0)
      return { rows: (res.data.data || []) as Notification[], unreadCount }
    },
    refetchInterval: 30_000, // poll every 30s
  })

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markRead(id: string) {
    try {
      await apiFns.markNotificationRead(id)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch (err) { toast.error((err as ApiError).message) }
  }

  async function markAllRead() {
    try {
      await apiFns.markAllNotificationsRead()
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All marked as read')
    } catch (err) { toast.error((err as ApiError).message) }
  }

  const notifications = data?.rows || []
  const unread = data?.unreadCount || 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Bell className={cn('h-4.5 w-4.5', unread > 0 && 'animate-swing')} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && <Badge variant="secondary" className="text-[10px]">{unread} new</Badge>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto rh-scroll">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-40" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.isRead) markRead(n.id); setOpen(false); navigate('home') }}
                  className={cn(
                    'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition last:border-0 hover:bg-muted/50',
                    !n.isRead && 'bg-primary/5',
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-base">
                    {ICONS[n.type] || '🔔'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="rh-line-clamp-2 mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t bg-muted/30 px-4 py-2 text-center">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setOpen(false); navigate('home') }}>
              View all activity
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
