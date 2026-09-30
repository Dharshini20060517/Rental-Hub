'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/format'
import { ShieldCheck, Clock, CreditCard, Lock, ChevronLeft, CheckCircle2, CalendarDays, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { calculatePrice, type PricingRule } from '@/lib/pricing'

export function CheckoutView() {
  const params = useRouterStore((s) => s.params)
  const equipmentId = params.equipmentId
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = useState<'review' | 'payment' | 'success'>('review')
  const [loading, setLoading] = useState(false)
  const [bookingId, setBookingId] = useState('')
  const [bookingTotal, setBookingTotal] = useState(0)
  const [bookingDeposit, setBookingDeposit] = useState(0)
  const [bookingBase, setBookingBase] = useState(0)

  // Convert ISO string from URL params to YYYY-MM-DD for date inputs
  function toDateString(iso: string | undefined, offsetDays: number): string {
    if (iso) {
      try {
        return new Date(iso).toISOString().slice(0, 10)
      } catch { /* fall through to default */ }
    }
    return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
  }

  // Default dates: tomorrow to +3 days (or from URL params)
  const [startDate, setStartDate] = useState(toDateString(params.startDate, 1))
  const [endDate, setEndDate] = useState(toDateString(params.endDate, 4))

  // Fetch equipment details
  const { data: equipment, isLoading: eqLoading } = useQuery({
    queryKey: ['equipment', equipmentId],
    queryFn: () => apiFns.getEquipment(equipmentId!),
    enabled: !!equipmentId,
  })

  if (!equipmentId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-muted-foreground">No equipment selected. Please browse and choose equipment first.</p>
        <Button className="mt-4" onClick={() => navigate('search')}>Browse equipment</Button>
      </div>
    )
  }

  // Show full checkout page even if not logged in — only ask for login when they click "Hold this slot"

  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

  // Calculate estimated price from equipment data
  const pricing = equipment ? calculatePrice(
    equipment.baseDailyPrice,
    equipment.baseDeposit,
    start,
    end,
    ((equipment.pricingRules as PricingRule[]) || []),
  ) : null

  async function handleCreateBooking() {
    if (!equipment) return
    // If not logged in, redirect to login with checkout context
    if (!user) {
      navigate('login', { redirect: 'checkout', equipmentId, startDate: startDate, endDate: endDate })
      return
    }
    setLoading(true)
    try {
      const result = await apiFns.createBooking({
        equipmentId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      }) as { id: string; totalAmount: number; depositAmount: number; baseAmount: number }
      setBookingId(result.id)
      setBookingTotal(result.totalAmount)
      setBookingDeposit(result.depositAmount)
      setBookingBase(result.totalAmount - result.depositAmount)
      setStep('payment')
      toast.success('Booking held for 10 minutes')
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePay() {
    setLoading(true)
    try {
      await apiFns.payBooking(bookingId)
      setStep('success')
      toast.success('Payment successful! Booking confirmed.')
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('equipment', { id: equipmentId })} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to equipment
      </button>
      <Breadcrumbs items={[{ label: 'Home', view: 'home' }, { label: 'Browse', view: 'search' }, { label: 'Equipment', view: 'equipment', params: { id: equipmentId } }, { label: 'Checkout' }]} />

      <h1 className="mb-6 text-2xl font-bold tracking-tight">Checkout</h1>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {['review', 'payment', 'success'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
              step === s || (step === 'success' && i < 2) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {step === 'success' && i < 2 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-sm capitalize">{s === 'review' ? 'Review' : s === 'payment' ? 'Payment' : 'Done'}</span>
            {i < 2 && <div className="h-0.5 w-8 bg-border" />}
          </div>
        ))}
      </div>

      {step === 'review' && (
        <div className="space-y-4">
          {/* Equipment summary */}
          {equipment && (
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {equipment.images?.[0] && (
                   
                  <img src={equipment.images[0].url} alt={equipment.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{equipment.title}</p>
                <p className="text-sm text-muted-foreground">{equipment.category?.name} · {equipment.city || 'Location on request'}</p>
                <p className="text-sm font-bold text-primary">{formatCurrency(equipment.baseDailyPrice)}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
              </div>
            </div>
          )}

          {/* Date selection */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Select dates</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start" className="text-xs">Start date</Label>
                <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end" className="text-xs">End date</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Duration: {days} day{days !== 1 ? 's' : ''}</p>
          </div>

          {/* Price estimate */}
          {pricing && (
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
              <h2 className="mb-3 font-semibold">Price estimate</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{formatCurrency(equipment!.baseDailyPrice)} × {days} days</span><span>{formatCurrency(pricing.baseTotal)}</span></div>
                {pricing.adjustments.map((adj, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{adj.label}</span>
                    <span className={adj.type === 'discount' ? 'text-emerald-600' : 'text-amber-600'}>
                      {adj.type === 'discount' ? '−' : '+'}{formatCurrency(adj.amount)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Rental total</span><span className="font-bold">{formatCurrency(pricing.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Security deposit (held, refunded on return)</span><span>{formatCurrency(pricing.deposit)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total to pay now</span><span className="text-primary">{formatCurrency(pricing.total)}</span></div>
                <p className="text-xs text-muted-foreground">Deposit of {formatCurrency(pricing.deposit)} is held separately and refunded on safe return.</p>
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Customer</h2>
            {user ? (
              <>
                <p className="text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Please log in to continue with booking.</p>
            )}
          </div>

          {/* Rental terms */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Rental terms</h2>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Security deposit held, refunded on safe return</p>
              <p className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> 10-minute hold to complete payment</p>
              <p className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-primary" /> Free cancellation up to 24h before start</p>
            </div>
          </div>

          <Button onClick={handleCreateBooking} disabled={loading || eqLoading || !equipment} className="w-full" size="lg">
            {loading ? 'Creating booking…' : eqLoading ? 'Loading…' : user ? `Hold this slot · ${pricing ? formatCurrency(pricing.total) : '—'}` : 'Log in to book this equipment'}
          </Button>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-4">
          {/* Equipment + dates summary */}
          {equipment && (
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="h-14 w-18 shrink-0 overflow-hidden rounded-lg bg-muted">
                {equipment.images?.[0] && (
                   
                  <img src={equipment.images[0].url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{equipment.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → {new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {days}d</p>
              </div>
            </div>
          )}

          {/* Payment breakdown */}
          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Payment breakdown</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Rental charge</span><span>{formatCurrency(bookingTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Security deposit (held separately)</span><span>{formatCurrency(bookingDeposit)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total charged now</span><span className="text-primary">{formatCurrency(bookingTotal)}</span></div>
              <p className="text-xs text-muted-foreground">Deposit of {formatCurrency(bookingDeposit)} is held and will be released on safe return.</p>
            </div>
          </div>

          {/* Simulated payment */}
          <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-center">
            <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Simulated payment</p>
            <p className="text-xs text-muted-foreground">No real charge — this is a demo environment</p>
          </div>

          <Button onClick={handlePay} disabled={loading} className="w-full" size="lg">
            {loading ? 'Processing…' : `Confirm & pay ${formatCurrency(bookingTotal)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3" />
            Hold expires in 10 minutes
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Booking confirmed!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your booking has been confirmed. The owner will be notified.</p>
            {equipment && (
              <div className="mt-4 rounded-lg bg-muted/30 p-3 text-left text-sm">
                <p className="font-medium">{equipment.title}</p>
                <p className="text-muted-foreground">{new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → {new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                <p className="mt-1 flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-bold text-primary">{formatCurrency(bookingTotal)}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">Deposit held</span><span>{formatCurrency(bookingDeposit)}</span></p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={() => navigate('booking-detail', { id: bookingId })}>View booking</Button>
            <Button variant="outline" onClick={() => navigate('my-rentals')}>My rentals</Button>
          </div>
        </div>
      )}
    </div>
  )
}
