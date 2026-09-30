'use client'

import { ShieldCheck, BadgeCheck, Calendar, Clock, CheckCircle2, Lock, Zap, FileCheck } from 'lucide-react'
import { formatDate } from '@/lib/format'

type OwnerStats = {
  listingsCount: number
  avgRating: number
  reviewsCount: number
  memberSince: string
}

const SAFETY_CHECKS = [
  { icon: BadgeCheck, label: 'Verified owner', desc: 'Identity confirmed' },
  { icon: ShieldCheck, label: 'Secure deposit', desc: 'Held safely, refunded on return' },
  { icon: FileCheck, label: 'Quality checked', desc: 'Equipment inspected before rental' },
  { icon: Lock, label: 'Secure payments', desc: 'Encrypted transaction processing' },
  { icon: Zap, label: 'Instant availability', desc: 'No double-booking, real-time updates' },
  { icon: Clock, label: '24h support', desc: 'Round-the-clock assistance' },
]

export function TrustSafety({ ownerName, isVerified, ownerStats }: {
  ownerName: string
  isVerified: boolean
  ownerStats?: OwnerStats
}) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-emerald-500/5 via-transparent to-primary/5 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        Trust & safety
      </h3>

      {/* Owner trust metrics */}
      {ownerStats && (
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border bg-card p-3">
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-emerald-600">
              {isVerified ? <BadgeCheck className="h-4 w-4" /> : null}
              {isVerified ? 'Yes' : 'No'}
            </p>
            <p className="text-[10px] text-muted-foreground">Verified</p>
          </div>
          <div className="text-center border-x">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {new Date(ownerStats.memberSince).getFullYear()}
            </p>
            <p className="text-[10px] text-muted-foreground">Member since</p>
          </div>
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-amber-500">
              {ownerStats.avgRating > 0 ? ownerStats.avgRating.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg rating</p>
          </div>
        </div>
      )}

      {/* Safety checklist */}
      <div className="space-y-2">
        {SAFETY_CHECKS.map((check) => (
          <div key={check.label} className="flex items-start gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <check.icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                {check.label}
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              </p>
              <p className="text-[11px] text-muted-foreground">{check.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-emerald-500/5 px-3 py-2 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-500" />
        RentalHub guarantee: Every rental is backed by our trust & safety policy
      </div>
    </div>
  )
}
