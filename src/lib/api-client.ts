'use client'

import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

// Single Axios instance with httpOnly-cookie auth + 401→refresh→retry interceptor.
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 20000,
})

let isRefreshing = false
let queue: Array<() => void> = []

function flush() {
  queue.forEach((cb) => cb())
  queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status

    // Don't retry on auth endpoints themselves (avoid loops). /auth/me 401 means
    // "not logged in" (the bootstrap call), not "session expired", so don't redirect.
    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register') ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/me')

    if (status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      if (isRefreshing) {
        // Wait for the in-flight refresh, then retry
        return new Promise((resolve) => {
          queue.push(() => resolve(api(original)))
        })
      }
      isRefreshing = true
      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true })
        flush()
        return api(original)
      } catch (refreshErr) {
        queue = []
        // refresh failed → broadcast logout (only meaningful for authenticated-context calls)
        window.dispatchEvent(new CustomEvent('rh:session-expired'))
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

// Convenience: unwrap envelope + reject with { code, message, details, status }
export type ApiError = {
  code: string
  message: string
  details?: unknown
  status: number
}

export async function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await api.request<{ success: boolean; data: T; error: ApiError | null; meta?: unknown }>(config)
    return res.data.data
  } catch (e) {
    const err = e as AxiosError<{ error?: ApiError | null }>
    const payload = err.response?.data?.error
    const apiError: ApiError = {
      code: payload?.code || err.code || 'REQUEST_FAILED',
      message: payload?.message || err.message || 'Network error',
      details: payload?.details,
      status: err.response?.status || 0,
    }
    throw apiError
  }
}

// Typed helper functions used across the app (one place to maintain the contract)
import type { SafeUser, EquipmentWithRelations } from '@/lib/serializers'

export const apiFns = {
  // Auth
  me: () => request<SafeUser>({ url: '/auth/me' }),
  login: (email: string, password: string) =>
    request<SafeUser>({ method: 'POST', url: '/auth/login', data: { email, password } }),
  register: (data: Record<string, unknown>) =>
    request<SafeUser>({ method: 'POST', url: '/auth/register', data }),
  logout: () => request<{ success: boolean }>({ method: 'POST', url: '/auth/logout' }),
  forgotPassword: (email: string) =>
    request<{ sent: boolean }>({ method: 'POST', url: '/auth/forgot-password', data: { email } }),
  resetPassword: (token: string, password: string) =>
    request<{ success: boolean }>({ method: 'POST', url: '/auth/reset-password', data: { token, password } }),
  updateProfile: (data: Record<string, unknown>) =>
    request<SafeUser>({ method: 'PATCH', url: '/auth/profile', data }),
  uploadAvatar: (file: File) => {
    const fd = new FormData()
    fd.append('avatar', file)
    return request<SafeUser>({ method: 'POST', url: '/auth/avatar', data: fd, headers: { 'Content-Type': 'multipart/form-data' } })
  },

  // Categories
  listCategories: () => request<{ id: string; name: string; slug: string; description: string | null }[]>({ url: '/categories' }),
  createCategory: (data: Record<string, unknown>) => request({ method: 'POST', url: '/categories', data }),
  updateCategory: (id: string, data: Record<string, unknown>) => request({ method: 'PATCH', url: `/categories/${id}`, data }),
  deleteCategory: (id: string) => request({ method: 'DELETE', url: `/categories/${id}` }),

  // Equipment
  listEquipment: (params: Record<string, string | number | undefined>) =>
    request<EquipmentWithRelations[]>({ url: '/equipment', params }),
  getEquipment: (id: string, params?: Record<string, string | number>) =>
    request<EquipmentWithRelations & { rating: number; reviewCount: number; wishlistCount: number; distance?: number }>({ url: `/equipment/${id}`, params }),
  getPriceInsight: (id: string) => request({ url: `/equipment/${id}/price-insight` }),
  compareEquipment: (ids: string[]) => request<EquipmentWithRelations[]>({ url: '/equipment/compare', params: { ids: ids.join(',') } }),
  trendingEquipment: (limit?: number) => request<EquipmentWithRelations[]>({ url: '/equipment/trending', params: limit ? { limit } : undefined }),
  myEquipment: (params?: Record<string, string>) => request<EquipmentWithRelations[]>({ url: '/equipment/my', params }),
  createEquipment: (data: Record<string, unknown>) => request({ method: 'POST', url: '/equipment', data }),
  updateEquipment: (id: string, data: Record<string, unknown>) => request({ method: 'PATCH', url: `/equipment/${id}`, data }),
  deleteEquipment: (id: string) => request({ method: 'DELETE', url: `/equipment/${id}` }),
  uploadImages: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('images', f))
    return request({ method: 'POST', url: `/equipment/${id}/images`, data: fd, headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteImage: (id: string, imageId: string) => request({ method: 'DELETE', url: `/equipment/${id}/images/${imageId}` }),

  // Availability
  listAvailability: (id: string) => request({ url: `/equipment/${id}/availability` }),
  blockAvailability: (id: string, data: Record<string, unknown>) => request({ method: 'POST', url: `/equipment/${id}/availability`, data }),
  unblockAvailability: (id: string, blockId: string) => request({ method: 'DELETE', url: `/equipment/${id}/availability/${blockId}` }),

  // Maintenance
  listMaintenance: (id: string) => request({ url: `/equipment/${id}/maintenance` }),
  addMaintenance: (id: string, data: Record<string, unknown>) => request({ method: 'POST', url: `/equipment/${id}/maintenance`, data }),
  updateMaintenance: (id: string, logId: string, data: Record<string, unknown>) => request({ method: 'PATCH', url: `/equipment/${id}/maintenance/${logId}`, data }),
  deleteMaintenance: (id: string, logId: string) => request({ method: 'DELETE', url: `/equipment/${id}/maintenance/${logId}` }),
  listMaintenanceWindows: (id: string) => request({ url: `/equipment/${id}/maintenance-windows` }),
  addMaintenanceWindow: (id: string, data: Record<string, unknown>) => request({ method: 'POST', url: `/equipment/${id}/maintenance-windows`, data }),
  deleteMaintenanceWindow: (id: string, windowId: string) => request({ method: 'DELETE', url: `/equipment/${id}/maintenance-windows/${windowId}` }),

  // Reviews
  listReviews: (id: string, params?: Record<string, number | string>) => request({ url: `/equipment/${id}/reviews`, params }),
  createReview: (data: Record<string, unknown>) => request({ method: 'POST', url: '/reviews', data }),
  voteReviewHelpful: (id: string) => request<{ helpful: boolean; helpfulVotes: number }>({ method: 'POST', url: `/reviews/${id}/helpful` }),

  // Wishlist
  listWishlist: (params?: Record<string, number>) => request({ url: '/wishlist', params }),
  toggleWishlist: (equipmentId: string) => request<{ inWishlist: boolean }>({ method: 'POST', url: `/wishlist/${equipmentId}` }),
  removeFromWishlist: (equipmentId: string) => request({ method: 'DELETE', url: `/wishlist/${equipmentId}` }),
  getWishlistStatus: (equipmentId: string) => request<{ inWishlist: boolean }>({ url: `/wishlist/${equipmentId}` }),

  // Admin
  adminListUsers: (params: Record<string, string | undefined>) => request({ url: '/admin/users', params }),
  adminUpdateUser: (id: string, data: Record<string, unknown>) => request({ method: 'PATCH', url: `/admin/users/${id}`, data }),
  adminListEquipment: (params?: Record<string, string>) => request<EquipmentWithRelations[]>({ url: '/admin/equipment', params }),
  adminModerate: (id: string, action: 'approve' | 'reject', notes?: string) =>
    request({ method: 'PATCH', url: `/admin/equipment/${id}/moderate`, data: { action, notes } }),
  adminAuditLogs: (params?: Record<string, string | undefined>) => request({ url: '/admin/audit-logs', params }),
  adminStats: () => request({ url: '/admin/stats' }),
  adminRevenue: () => request({ url: '/admin/revenue' }),
  adminGrowth: () => request({ url: '/admin/growth' }),
  adminOverview: () => request({ url: '/admin/overview' }),

  // Owner dashboard
  ownerStats: () => request({ url: '/owner/stats' }),
  ownerRevenue: () => request({ url: '/owner/revenue' }),
  ownerActivity: () => request({ url: '/owner/activity' }),

  // Bookings
  createBooking: (data: Record<string, unknown>) => request({ method: 'POST', url: '/bookings', data }),
  listBookings: (params?: Record<string, string | number>) => request({ url: '/bookings', params }),
  getBooking: (id: string) => request({ url: `/bookings/${id}` }),
  confirmBooking: (id: string) => request({ method: 'POST', url: `/bookings/${id}/confirm` }),
  cancelBooking: (id: string, reason: string) => request({ method: 'POST', url: `/bookings/${id}/cancel`, data: { reason } }),
  pickupBooking: (id: string, data?: Record<string, unknown>) => request({ method: 'POST', url: `/bookings/${id}/pickup`, data }),
  startUseBooking: (id: string) => request({ method: 'POST', url: `/bookings/${id}/start-use` }),
  returnBooking: (id: string, data: Record<string, unknown>) => request({ method: 'POST', url: `/bookings/${id}/return`, data }),
  inspectBooking: (id: string, pass: boolean) => request({ method: 'POST', url: `/bookings/${id}/inspect`, data: { pass } }),
  completeBooking: (id: string) => request({ method: 'POST', url: `/bookings/${id}/complete` }),
  extendBooking: (id: string, newEndDate: string) => request({ method: 'POST', url: `/bookings/${id}/extend`, data: { newEndDate } }),
  approveBooking: (id: string, approve: boolean) => request({ method: 'POST', url: `/bookings/${id}/approve`, data: { approve } }),
  listBookingMessages: (id: string) => request({ url: `/bookings/${id}/messages` }),
  sendBookingMessage: (id: string, message: string, attachmentUrl?: string) =>
    request({ method: 'POST', url: `/bookings/${id}/messages`, data: { message, attachmentUrl } }),
  payBooking: (id: string, idempotencyKey?: string) =>
    request({ method: 'POST', url: `/bookings/${id}/payments`, data: { idempotencyKey } }),
  checkAvailability: (equipmentId: string, startDate: string, endDate: string) =>
    request({ method: 'POST', url: '/bookings/check-availability', data: { equipmentId, startDate, endDate } }),
  submitBookingReview: (bookingId: string, data: Record<string, unknown>) =>
    request({ method: 'POST', url: `/bookings/${bookingId}/review`, data }),

  // Disputes
  raiseDispute: (data: Record<string, unknown>) => request({ method: 'POST', url: '/disputes', data }),
  listDisputes: (params?: Record<string, string | number>) => request({ url: '/disputes', params }),
  getDispute: (id: string) => request({ url: `/disputes/${id}` }),
  listDisputeMessages: (id: string) => request({ url: `/disputes/${id}/messages` }),
  sendDisputeMessage: (id: string, message: string) => request({ method: 'POST', url: `/disputes/${id}/messages`, data: { message } }),
  resolveDispute: (id: string, resolution: string, resolutionNote?: string) =>
    request({ method: 'POST', url: `/disputes/${id}/resolve`, data: { resolution, resolutionNote } }),

  // Analytics
  analyticsRevenue: (params?: Record<string, string>) => request({ url: '/analytics/revenue', params }),
  analyticsUtilization: (params?: Record<string, string>) => request({ url: '/analytics/utilization', params }),
  analyticsPatterns: () => request({ url: '/analytics/patterns' }),
  analyticsLeaderboard: () => request({ url: '/analytics/leaderboard' }),

  // Intelligence
  getPricingSuggestions: () => request({ url: '/intelligence/pricing-suggestions' }),
  acceptPricingSuggestion: (id: string, editedPrice?: number) =>
    request({ method: 'POST', url: `/intelligence/pricing-suggestions/${id}`, data: { action: 'accept', editedPrice } }),
  dismissPricingSuggestion: (id: string) =>
    request({ method: 'POST', url: `/intelligence/pricing-suggestions/${id}`, data: { action: 'dismiss' } }),
  getRecommendations: (params?: Record<string, string | number>) => request({ url: '/intelligence/recommendations', params }),
  getFraudFlags: () => request({ url: '/intelligence/fraud-flags' }),
  getTrustScore: (userId?: string) => request({ url: '/intelligence/trust-score', params: userId ? { userId } : undefined }),
  getLatePredictions: () => request({ url: '/intelligence/late-prediction' }),
  runWhatIf: (data: Record<string, unknown>) => request({ method: 'POST', url: '/intelligence/what-if', data }),
  getDamageEstimate: (bookingId: string) => request({ url: '/intelligence/damage-estimate', params: { bookingId } }),
  runDamageComparison: (bookingId: string, data: Record<string, unknown>) => request({ method: 'POST', url: `/bookings/${bookingId}/damage-comparison`, data }),
  listDamageComparisons: (bookingId: string) => request({ url: `/bookings/${bookingId}/damage-comparison` }),
  reviewDamageFinding: (bookingId: string, comparisonId: string, status: string) =>
    request({ method: 'PATCH', url: `/bookings/${bookingId}/damage-comparison/${comparisonId}`, data: { status } }),
  getConditionPassport: (equipmentId: string) => request({ url: `/equipment/${equipmentId}/condition-passport` }),
  naturalLanguageSearch: (query: string) => request({ method: 'POST', url: '/search/natural', data: { query } }),
  listBundles: () => request({ url: '/bundles' }),
  createBundle: (data: Record<string, unknown>) => request({ method: 'POST', url: '/bundles', data }),
  joinWaitlist: (equipmentId: string, startDate: string, endDate: string) =>
    request({ method: 'POST', url: '/waitlist', data: { equipmentId, startDate, endDate } }),
  listWaitlist: () => request({ url: '/waitlist' }),
  leaveWaitlist: (id: string) => request({ method: 'DELETE', url: `/waitlist/${id}` }),
  getHealth: () => request({ url: '/health' }),
  gdprExport: () => request({ url: '/gdpr/export' }),
  gdprDelete: () => request({ method: 'DELETE', url: '/gdpr/delete' }),

  // Customer dashboard
  customerStats: () => request({ url: '/customer/stats' }),

  // Owner profile
  getOwnerProfile: (id: string, excludeId?: string) =>
    request({ url: `/users/${id}/profile`, params: excludeId ? { exclude: excludeId } : undefined }),

  // Notifications
  listNotifications: (params?: Record<string, string | number>) => request({ url: '/notifications', params }),
  markNotificationRead: (id: string) => request({ method: 'PATCH', url: `/notifications/${id}/read` }),
  markAllNotificationsRead: () => request<{ updated: number }>({ method: 'POST', url: '/notifications/read-all' }),
}
