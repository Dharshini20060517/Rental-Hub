'use client'

import { create } from 'zustand'

export type ViewKey =
  | 'home'
  | 'search'
  | 'equipment'
  | 'compare'
  | 'wishlist'
  | 'login'
  | 'register'
  | 'reset-password'
  | 'profile'
  | 'customer-dashboard'
  | 'owner-dashboard'
  | 'owner-listings'
  | 'listing-form'
  | 'maintenance'
  | 'checkout'
  | 'my-rentals'
  | 'booking-detail'
  | 'owner-bookings'
  | 'owner-calendar'
  | 'disputes'
  | 'dispute-detail'
  | 'admin-bookings'
  | 'admin-disputes'
  | 'admin-analytics'
  | 'owner-analytics'
  | 'pricing-suggestions'
  | 'fraud-flags'
  | 'admin-users'
  | 'admin-categories'
  | 'admin-moderation'
  | 'admin-audit'
  | 'admin-stats'

export const VIEW_ROLES: Record<ViewKey, 'public' | 'customer' | 'owner' | 'admin'> = {
  home: 'public',
  search: 'public',
  equipment: 'public',
  compare: 'public',
  wishlist: 'customer',
  login: 'public',
  register: 'public',
  'reset-password': 'public',
  profile: 'customer',
  'customer-dashboard': 'customer',
  'owner-dashboard': 'owner',
  'owner-listings': 'owner',
  'listing-form': 'owner',
  maintenance: 'owner',
  checkout: 'public',
  'my-rentals': 'customer',
  'booking-detail': 'public',
  'owner-bookings': 'owner',
  'owner-calendar': 'owner',
  disputes: 'customer',
  'dispute-detail': 'customer',
  'admin-bookings': 'admin',
  'admin-disputes': 'admin',
  'admin-analytics': 'admin',
  'owner-analytics': 'owner',
  'pricing-suggestions': 'owner',
  'fraud-flags': 'admin',
  'admin-users': 'admin',
  'admin-categories': 'admin',
  'admin-moderation': 'admin',
  'admin-audit': 'admin',
  'admin-stats': 'admin',
}

const validViews = new Set<ViewKey>([
  'home', 'search', 'equipment', 'compare', 'wishlist', 'login', 'register',
  'reset-password', 'profile', 'customer-dashboard', 'owner-dashboard', 'owner-listings', 'listing-form', 'maintenance',
  'checkout', 'my-rentals', 'booking-detail', 'owner-bookings', 'owner-calendar', 'disputes', 'dispute-detail',
  'admin-bookings', 'admin-disputes', 'admin-analytics', 'owner-analytics', 'pricing-suggestions', 'fraud-flags',
  'admin-users', 'admin-categories', 'admin-moderation', 'admin-audit', 'admin-stats',
])

interface RouteState {
  view: ViewKey
  params: Record<string, string>
  compareIds: string[]
  sidebarOpen: boolean
  navigate: (view: ViewKey, params?: Record<string, string>) => void
  replace: (view: ViewKey, params?: Record<string, string>) => void
  back: () => void
  initFromUrl: () => void
  setCompareIds: (ids: string[]) => void
  toggleCompare: (id: string) => void
  setSidebar: (open: boolean) => void
}

function parseUrl(): { view: ViewKey; params: Record<string, string> } {
  if (typeof window === 'undefined') return { view: 'home', params: {} }
  const sp = new URLSearchParams(window.location.search)
  const view = (sp.get('view') as ViewKey) || 'home'
  const params: Record<string, string> = {}
  sp.forEach((v, k) => {
    if (k !== 'view') params[k] = v
  })
  return { view, params }
}

function pushState(view: ViewKey, params: Record<string, string>, replace = false) {
  const sp = new URLSearchParams({ view, ...params })
  const url = `${window.location.pathname}?${sp.toString()}`
  if (replace) {
    window.history.replaceState({ view, params }, '', url)
  } else {
    window.history.pushState({ view, params }, '', url)
  }
}

export const useRouterStore = create<RouteState>((set, get) => ({
  view: 'home',
  params: {},
  compareIds: [],
  sidebarOpen: false,

  navigate: (view, params = {}) => {
    set({ view, params, sidebarOpen: false })
    pushState(view, params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },

  replace: (view, params = {}) => {
    set({ view, params })
    pushState(view, params, true)
  },

  back: () => window.history.back(),

  initFromUrl: () => {
    const { view: rawView, params } = parseUrl()
    const view: ViewKey = validViews.has(rawView) ? rawView : 'home'
    const compareIds = params.ids ? params.ids.split(',').filter(Boolean) : get().compareIds
    set({ view, params, compareIds })
  },

  setCompareIds: (ids) => set({ compareIds: ids }),

  toggleCompare: (id) => {
    const cur = get().compareIds
    let next: string[]
    if (cur.includes(id)) {
      next = cur.filter((x) => x !== id)
    } else {
      next = [...cur, id]
      if (next.length > 3) next = next.slice(1)
    }
    set({ compareIds: next })
  },

  setSidebar: (open) => set({ sidebarOpen: open }),
}))
