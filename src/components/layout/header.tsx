'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouterStore, type ViewKey } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { NotificationBell } from '@/components/shared/notification-bell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  Search, Menu, Heart, LayoutGrid, Wrench, Shield, Plus, User as UserIcon, LogOut, Package, LifeBuoy, Scale, BarChart3, ClipboardList, Users, BookCheck, ScrollText, Gauge, LayoutDashboard, Calendar, AlertCircle, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { view: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; roles?: ('customer' | 'owner' | 'admin')[] }

const NAV: NavItem[] = [
  { view: 'search', label: 'Browse', icon: LayoutGrid },
  { view: 'customer-dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['customer'] },
  { view: 'my-rentals', label: 'My Rentals', icon: Calendar, roles: ['customer'] },
  { view: 'disputes', label: 'Disputes', icon: AlertCircle, roles: ['customer'] },
  { view: 'owner-dashboard', label: 'Dashboard', icon: Gauge, roles: ['owner'] },
  { view: 'owner-bookings', label: 'Bookings', icon: Calendar, roles: ['owner'] },
  { view: 'owner-listings', label: 'Listings', icon: Package, roles: ['owner'] },
  { view: 'owner-analytics', label: 'Analytics', icon: BarChart3, roles: ['owner'] },
  { view: 'admin-bookings', label: 'Bookings', icon: Calendar, roles: ['admin'] },
  { view: 'admin-disputes', label: 'Disputes', icon: AlertCircle, roles: ['admin'] },
  { view: 'admin-users', label: 'Users', icon: Users, roles: ['admin'] },
  { view: 'admin-analytics', label: 'Analytics', icon: BarChart3, roles: ['admin'] },
  { view: 'fraud-flags', label: 'Fraud', icon: ShieldAlert, roles: ['admin'] },
  { view: 'admin-audit', label: 'Audit', icon: ScrollText, roles: ['admin'] },
]

export function Header() {
  const navigate = useRouterStore((s) => s.navigate)
  const view = useRouterStore((s) => s.view)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const visibleNav = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role as 'customer' | 'owner' | 'admin')))

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate('search', q ? { q } : {})
  }

  function onLogout() {
    logout()
    navigate('home')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button onClick={() => navigate('home')} className="flex shrink-0 items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-bold tracking-tight">RentalHub</span>
            <span className="text-[10px] text-muted-foreground">Equipment Rental</span>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const active = view === item.view
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Search */}
        <form onSubmit={submitSearch} className="ml-auto hidden flex-1 max-w-xs md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search equipment..."
              className="h-9 pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1.5 md:ml-2">
          <ThemeToggle />
          {user && <NotificationBell />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-muted" aria-label="Account menu">
                  <Avatar className="h-8 w-8 border">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name || ''} /> : null}
                    <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-medium">{user.name || 'Account'}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium capitalize text-primary">
                    <Shield className="h-2.5 w-2.5" /> {user.role}
                    {user.isVerified && <BookCheck className="h-2.5 w-2.5" />}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('profile')}><UserIcon className="mr-2 h-4 w-4" /> Profile</DropdownMenuItem>
                {user.role === 'customer' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('customer-dashboard')}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('wishlist')}><Heart className="mr-2 h-4 w-4" /> Wishlist</DropdownMenuItem>
                  </>
                )}
                {user.role === 'owner' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('owner-dashboard')}><Gauge className="mr-2 h-4 w-4" /> Dashboard</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('owner-listings')}><Package className="mr-2 h-4 w-4" /> My Listings</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('listing-form')}><Plus className="mr-2 h-4 w-4" /> New Listing</DropdownMenuItem>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Administration</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate('admin-moderation')}><ClipboardList className="mr-2 h-4 w-4" /> Moderation Queue</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('admin-stats')}><BarChart3 className="mr-2 h-4 w-4" /> Analytics</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('admin-audit')}><ScrollText className="mr-2 h-4 w-4" /> Audit Log</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button variant="ghost" size="sm" onClick={() => navigate('login')}>Log in</Button>
              <Button size="sm" onClick={() => navigate('register')}>Get started</Button>
            </div>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto rh-scroll">
              <SheetTitle className="text-left">Menu</SheetTitle>
              <form onSubmit={(e) => { submitSearch(e); setOpen(false) }} className="mb-4 mt-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search equipment..." className="pl-9" />
                </div>
              </form>

              <nav className="flex flex-col gap-1">
                {/* Browse section */}
                {visibleNav.filter(n => !n.roles).length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Browse</p>
                    {visibleNav.filter(n => !n.roles).map((item) => {
                      const Icon = item.icon
                      return (
                        <button key={item.view} onClick={() => { navigate(item.view); setOpen(false) }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-primary/5 hover:text-primary">
                          <Icon className="h-4 w-4" /> {item.label}
                        </button>
                      )
                    })}
                  </>
                )}

                {/* Account section */}
                {visibleNav.filter(n => n.roles && (n.roles.includes('customer') || n.roles.includes('owner'))).length > 0 && user && (
                  <>
                    <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                    {visibleNav.filter(n => n.roles && (n.roles.includes('customer') || n.roles.includes('owner'))).map((item) => {
                      const Icon = item.icon
                      return (
                        <button key={item.view} onClick={() => { navigate(item.view); setOpen(false) }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-primary/5 hover:text-primary">
                          <Icon className="h-4 w-4" /> {item.label}
                        </button>
                      )
                    })}
                  </>
                )}

                {/* Admin section */}
                {visibleNav.filter(n => n.roles && n.roles.includes('admin')).length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Administration</p>
                    {visibleNav.filter(n => n.roles && n.roles.includes('admin')).map((item) => {
                      const Icon = item.icon
                      return (
                        <button key={item.view} onClick={() => { navigate(item.view); setOpen(false) }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-primary/5 hover:text-primary">
                          <Icon className="h-4 w-4" /> {item.label}
                        </button>
                      )
                    })}
                  </>
                )}

                {!user && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <Button variant="outline" className="w-full" onClick={() => { navigate('login'); setOpen(false) }}>Log in</Button>
                    <Button className="w-full" onClick={() => { navigate('register'); setOpen(false) }}>Get started</Button>
                  </div>
                )}
                {user && (
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { onLogout(); setOpen(false) }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
