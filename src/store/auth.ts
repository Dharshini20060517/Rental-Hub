'use client'

import { create } from 'zustand'
import { apiFns, type ApiError } from '@/lib/api-client'
import type { SafeUser } from '@/lib/serializers'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: SafeUser | null
  status: AuthStatus
  error: string | null
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (data: Record<string, unknown>) => Promise<void>
  logout: () => Promise<void>
  setUser: (u: SafeUser | null) => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  error: null,

  init: async () => {
    try {
      const user = await apiFns.me()
      set({ user, status: 'authenticated', error: null })
    } catch {
      set({ user: null, status: 'unauthenticated' })
    }
  },

  login: async (email, password) => {
    set({ error: null })
    try {
      const user = await apiFns.login(email, password)
      set({ user, status: 'authenticated', error: null })
    } catch (e) {
      const err = e as ApiError
      set({ error: err.message })
      throw err
    }
  },

  register: async (data) => {
    set({ error: null })
    try {
      const user = await apiFns.register(data)
      set({ user, status: 'authenticated', error: null })
    } catch (e) {
      const err = e as ApiError
      set({ error: err.message })
      throw err
    }
  },

  logout: async () => {
    try {
      await apiFns.logout()
    } catch {
      /* ignore */
    }
    set({ user: null, status: 'unauthenticated' })
  },

  setUser: (u) => set({ user: u, status: u ? 'authenticated' : 'unauthenticated' }),

  refreshUser: async () => {
    try {
      const user = await apiFns.me()
      set({ user, status: 'authenticated' })
    } catch {
      set({ user: null, status: 'unauthenticated' })
    }
  },
}))

export function useRole(): { role: string | null; isCustomer: boolean; isOwner: boolean; isAdmin: boolean } {
  const user = useAuthStore((s) => s.user)
  const role = user?.role ?? null
  return {
    role,
    isCustomer: role === 'customer',
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
  }
}
