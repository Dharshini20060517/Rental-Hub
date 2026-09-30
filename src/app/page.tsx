'use client'

import { useAuthStore } from '@/store/auth'
import { useRouterStore, VIEW_ROLES, type ViewKey } from '@/store/router'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { CompareBar } from '@/components/equipment/compare-bar'
import { Button } from '@/components/ui/button'
import { Wrench } from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { CardGridSkeleton } from '@/components/shared/states'
import { ScrollToTop } from '@/components/shared/scroll-to-top'

const views: Record<ViewKey, React.LazyExoticComponent<React.ComponentType>> = {
  home: lazy(() => import('@/views/home-view').then((m) => ({ default: m.HomeView }))),
  search: lazy(() => import('@/views/search-view').then((m) => ({ default: m.SearchView }))),
  equipment: lazy(() => import('@/views/equipment-detail-view').then((m) => ({ default: m.EquipmentDetailView }))),
  compare: lazy(() => import('@/views/compare-view').then((m) => ({ default: m.CompareView }))),
  wishlist: lazy(() => import('@/views/wishlist-view').then((m) => ({ default: m.WishlistView }))),
  login: lazy(() => import('@/views/auth-views').then((m) => ({ default: m.LoginView }))),
  register: lazy(() => import('@/views/auth-views').then((m) => ({ default: m.RegisterView }))),
  'reset-password': lazy(() => import('@/views/auth-views').then((m) => ({ default: m.ResetPasswordView }))),
  profile: lazy(() => import('@/views/profile-view').then((m) => ({ default: m.ProfileView }))),
  'customer-dashboard': lazy(() => import('@/views/customer-dashboard-view').then((m) => ({ default: m.CustomerDashboardView }))),
  'owner-dashboard': lazy(() => import('@/views/owner-dashboard-view').then((m) => ({ default: m.OwnerDashboardView }))),
  'owner-listings': lazy(() => import('@/views/owner-listings-view').then((m) => ({ default: m.OwnerListingsView }))),
  'listing-form': lazy(() => import('@/views/listing-form-view').then((m) => ({ default: m.ListingFormView }))),
  maintenance: lazy(() => import('@/views/maintenance-view').then((m) => ({ default: m.MaintenanceView }))),
  checkout: lazy(() => import('@/views/checkout-view').then((m) => ({ default: m.CheckoutView }))),
  'my-rentals': lazy(() => import('@/views/my-rentals-view').then((m) => ({ default: m.MyRentalsView }))),
  'booking-detail': lazy(() => import('@/views/booking-detail-view').then((m) => ({ default: m.BookingDetailView }))),
  'owner-bookings': lazy(() => import('@/views/owner-bookings-view').then((m) => ({ default: m.OwnerBookingsView }))),
  'owner-calendar': lazy(() => import('@/views/owner-calendar-view').then((m) => ({ default: m.OwnerCalendarView }))),
  disputes: lazy(() => import('@/views/disputes-view').then((m) => ({ default: m.DisputesView }))),
  'dispute-detail': lazy(() => import('@/views/dispute-detail-view').then((m) => ({ default: m.DisputeDetailView }))),
  'admin-bookings': lazy(() => import('@/views/admin-bookings-view').then((m) => ({ default: m.AdminBookingsView }))),
  'admin-disputes': lazy(() => import('@/views/admin-disputes-view').then((m) => ({ default: m.AdminDisputesView }))),
  'admin-analytics': lazy(() => import('@/views/admin-analytics-view').then((m) => ({ default: m.AdminAnalyticsView }))),
  'owner-analytics': lazy(() => import('@/views/owner-analytics-view').then((m) => ({ default: m.OwnerAnalyticsView }))),
  'pricing-suggestions': lazy(() => import('@/views/pricing-suggestions-view').then((m) => ({ default: m.PricingSuggestionsView }))),
  'fraud-flags': lazy(() => import('@/views/fraud-flags-view').then((m) => ({ default: m.FraudFlagsView }))),
  'admin-users': lazy(() => import('@/views/admin-users-view').then((m) => ({ default: m.AdminUsersView }))),
  'admin-categories': lazy(() => import('@/views/admin-categories-view').then((m) => ({ default: m.AdminCategoriesView }))),
  'admin-moderation': lazy(() => import('@/views/admin-moderation-view').then((m) => ({ default: m.AdminModerationView }))),
  'admin-audit': lazy(() => import('@/views/admin-audit-view').then((m) => ({ default: m.AdminAuditView }))),
  'admin-stats': lazy(() => import('@/views/admin-stats-view').then((m) => ({ default: m.AdminStatsView }))),
}

function ViewRouter() {
  const view = useRouterStore((s) => s.view)
  const params = useRouterStore((s) => s.params)
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)

  const requiredRole = VIEW_ROLES[view]
  const needsAuth = requiredRole !== 'public'
  const roleOk =
    !needsAuth ||
    (user && (requiredRole === 'customer' || user.role === requiredRole || user.role === 'admin'))

  const View = useMemo(() => views[view] || views.home, [view])

  // While session is resolving and the view needs auth, show a splash
  if (needsAuth && status === 'loading') {
    return <CardGridSkeleton count={3} />
  }

  // Auth guard
  if (needsAuth && !user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Wrench className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Authentication required</h2>
        <p className="text-sm text-muted-foreground">Please log in to continue.</p>
        <Button onClick={() => navigate('login', { redirect: view, ...params })}>Log in</Button>
      </div>
    )
  }

  if (needsAuth && !roleOk) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
        <h2 className="text-lg font-semibold">Not authorized</h2>
        <p className="text-sm text-muted-foreground">Your role does not have access to this page.</p>
        <Button onClick={() => navigate('home')}>Go home</Button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<CardGridSkeleton count={6} />}>
        <div key={view + JSON.stringify(params)} className="rh-fade-in">
          <View />
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}

export default function Home() {
  const status = useAuthStore((s) => s.status)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-primary" />
          <p className="text-sm text-muted-foreground">Loading RentalHub…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <ViewRouter />
      </main>
      <Footer />
      <CompareBar />
      <ScrollToTop />
    </div>
  )
}
