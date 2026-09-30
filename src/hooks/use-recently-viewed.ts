'use client'

import { useEffect, useState, useCallback } from 'react'

const KEY = 'rh_recently_viewed'
const MAX = 8

export type RecentlyViewedItem = {
  id: string
  title: string
  coverUrl: string | null
  baseDailyPrice: number
  city: string | null
  viewedAt: number
}

function read(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RecentlyViewedItem[]) : []
  } catch {
    return []
  }
}

function write(items: RecentlyViewedItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
    window.dispatchEvent(new CustomEvent('rh:recently-viewed-changed'))
  } catch {
    /* ignore */
  }
}

export function trackView(item: Omit<RecentlyViewedItem, 'viewedAt'>) {
  const items = read()
  const filtered = items.filter((i) => i.id !== item.id)
  filtered.unshift({ ...item, viewedAt: Date.now() })
  write(filtered)
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([])

  const refresh = useCallback(() => setItems(read()), [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const handler = () => refresh()
    window.addEventListener('rh:recently-viewed-changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('rh:recently-viewed-changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [refresh])

  return items
}
