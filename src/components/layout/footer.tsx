'use client'

import { Wrench, Github, Twitter, Linkedin, Mail } from 'lucide-react'
import { useRouterStore, type ViewKey } from '@/store/router'

const exploreLinks: { label: string; view: ViewKey }[] = [
  { label: 'Browse Equipment', view: 'search' },
  { label: 'How it works', view: 'home' },
  { label: 'Compare', view: 'compare' },
  { label: 'Trending', view: 'home' },
]

const accountLinks: { label: string; view: ViewKey }[] = [
  { label: 'Log in', view: 'login' },
  { label: 'Sign up', view: 'register' },
  { label: 'Become a partner', view: 'register' },
]

export function Footer() {
  const navigate = useRouterStore((s) => s.navigate)
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold">RentalHub</span>
                <p className="text-[10px] text-muted-foreground">Equipment Rental Platform</p>
              </div>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              The marketplace for renting and listing equipment — from power tools to excavators.
            </p>
            {/* Social icons */}
            <div className="flex gap-2 pt-1">
              {[
                { icon: Twitter, label: 'Twitter' },
                { icon: Github, label: 'GitHub' },
                { icon: Linkedin, label: 'LinkedIn' },
                { icon: Mail, label: 'Email' },
              ].map((s) => (
                <button
                  key={s.label}
                  aria-label={s.label}
                  className="grid h-8 w-8 place-items-center rounded-lg border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-primary hover:shadow-sm"
                >
                  <s.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="mb-3 text-sm font-semibold">Explore</p>
            <div className="space-y-2">
              {exploreLinks.map((l) => (
                <button key={l.label} onClick={() => navigate(l.view)} className="block text-sm text-muted-foreground transition hover:text-foreground hover:translate-x-0.5">
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account */}
          <div>
            <p className="mb-3 text-sm font-semibold">Account</p>
            <div className="space-y-2">
              {accountLinks.map((l) => (
                <button key={l.label} onClick={() => navigate(l.view)} className="block text-sm text-muted-foreground transition hover:text-foreground hover:translate-x-0.5">
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div>
            <p className="mb-3 text-sm font-semibold">Why RentalHub</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Verified owners</p>
              <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Real-time availability</p>
              <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Dynamic pricing</p>
              <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Secure deposits</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} RentalHub. Built with Next.js 16 + Prisma.</p>
          <div className="flex items-center gap-4">
            <button className="transition hover:text-foreground">Privacy</button>
            <button className="transition hover:text-foreground">Terms</button>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">Phase 1 · Foundation & Marketplace</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
