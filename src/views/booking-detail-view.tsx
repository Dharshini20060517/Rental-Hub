'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns, type ApiError } from '@/lib/api-client'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2, Clock, Package, Send, ChevronLeft, AlertCircle, XCircle, ShieldCheck, Send as SendIcon, Star,
} from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'

const STATUS_STEPS = ['pending', 'held', 'confirmed', 'picked_up', 'in_use', 'return_pending', 'returned', 'inspected', 'completed']

export function BookingDetailView() {
  const id = useRouterStore((s) => s.params.id)
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [message, setMessage] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' })
  const [reviewBusy, setReviewBusy] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => apiFns.getBooking(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  })

  const b = booking as {
    id: string; status: string; startDate: string; endDate: string; days: number;
    baseAmount: number; totalAmount: number; depositAmount: number; commissionAmount: number;
    cancellationPolicy: string; holdExpiresAt: string | null;
    confirmedAt: string | null; pickedUpAt: string | null; returnedAt: string | null; completedAt: string | null;
    equipment: { id: string; title: string; images: { url: string; isPrimary: boolean }[]; category: { name: string } };
    customer: { id: string; name: string; avatarUrl: string | null };
    owner: { id: string; name: string; businessName: string | null; avatarUrl: string | null };
    messages: { id: string; message: string; createdAt: string; senderId: string; sender: { name: string; avatarUrl: string | null } }[];
    statusHistory: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
    payments: { id: string; type: string; amount: number; status: string; createdAt: string }[];
  } | undefined

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [b?.messages.length])

  async function handleAction(action: string, fn: () => Promise<unknown>) {
    setActionLoading(action)
    try {
      await fn()
      qc.invalidateQueries({ queryKey: ['booking', id] })
      toast.success('Action completed')
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setActionLoading(null)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    try {
      await apiFns.sendBookingMessage(id!, message)
      setMessage('')
      qc.invalidateQueries({ queryKey: ['booking', id] })
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-8"><CardGridSkeleton count={2} /></div>
  if (!b) return <div className="mx-auto max-w-3xl px-4 py-12"><EmptyState title="Booking not found" /></div>

  const isCustomer = user?.id === b.customer.id
  const isOwner = user?.id === b.owner.id
  const currentStepIndex = STATUS_STEPS.indexOf(b.status)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate(isCustomer ? 'my-rentals' : 'owner-bookings')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <Breadcrumbs items={[{ label: 'Home', view: 'home' }, { label: isCustomer ? 'My Rentals' : 'Bookings', view: isCustomer ? 'my-rentals' : 'owner-bookings' }, { label: 'Booking' }]} />

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{b.equipment.title}</h1>
          <p className="text-sm text-muted-foreground">Booking #{b.id.slice(-8)} · {formatDate(b.startDate)} → {formatDate(b.endDate)}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium capitalize',
          b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
          b.status === 'cancelled' ? 'bg-rose-500/10 text-rose-600' :
          b.status === 'disputed' || b.status === 'late' ? 'bg-amber-500/10 text-amber-600' :
          'bg-sky-500/10 text-sky-600'
        )}>
          {b.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Status timeline */}
          {b.status !== 'cancelled' && b.status !== 'disputed' && (
            <Card>
              <CardHeader><CardTitle className="text-base">Rental timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between overflow-x-auto rh-scroll">
                  {STATUS_STEPS.map((step, i) => {
                    const isDone = i <= currentStepIndex
                    const isCurrent = i === currentStepIndex
                    return (
                      <div key={step} className="flex flex-1 flex-col items-center">
                        <div className={cn('grid h-8 w-8 place-items-center rounded-full border-2 transition',
                          isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-background text-muted-foreground',
                          isCurrent && 'ring-2 ring-primary/30 ring-offset-2'
                        )}>
                          {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                        </div>
                        <span className={cn('mt-1 text-[10px] font-medium', isDone ? 'text-foreground' : 'text-muted-foreground')}>
                          {step.replace(/_/g, ' ')}
                        </span>
                        {i < STATUS_STEPS.length - 1 && <div className={cn('mt-1 h-0.5 w-full', isDone ? 'bg-primary' : 'bg-muted')} />}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat */}
          <Card>
            <CardHeader><CardTitle className="text-base">Booking chat</CardTitle></CardHeader>
            <CardContent>
              <div ref={chatRef} className="mb-3 max-h-64 space-y-2 overflow-y-auto rh-scroll">
                {b.messages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
                ) : (
                  b.messages.map((m) => (
                    <div key={m.id} className={cn('flex gap-2', m.senderId === user?.id && 'flex-row-reverse')}>
                      <Avatar className="h-7 w-7 shrink-0">
                        {m.sender.avatarUrl && <AvatarImage src={m.sender.avatarUrl} alt="" />}
                        <AvatarFallback className="text-[10px]">{m.sender.name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className={cn('max-w-[70%] rounded-lg p-2.5 text-sm', m.senderId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                        <p>{m.message}</p>
                        <p className={cn('mt-0.5 text-[10px]', m.senderId === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message…" className="h-9" />
                <Button type="submit" size="icon" disabled={!message.trim()}><SendIcon className="h-4 w-4" /></Button>
              </form>
            </CardContent>
          </Card>

          {/* Status history */}
          <Card>
            <CardHeader><CardTitle className="text-base">Status history</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {b.statusHistory.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-2 text-sm">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="flex-1">
                      <span className="font-medium capitalize">{h.toStatus.replace(/_/g, ' ')}</span>
                      {h.note && <span className="ml-1 text-xs text-muted-foreground">— {h.note}</span>}
                      <p className="text-[10px] text-muted-foreground/70">{formatDateTime(h.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Pricing */}
          <Card>
            <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Base ({b.days}d)</span><span>{formatCurrency(b.baseAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit (held)</span><span>{formatCurrency(b.depositAmount)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-primary">{formatCurrency(b.totalAmount)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Commission</span><span>{formatCurrency(b.commissionAmount)}</span></div>
            </CardContent>
          </Card>

          {/* Parties */}
          <Card>
            <CardHeader><CardTitle className="text-base">Parties</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Customer</p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {b.customer.avatarUrl && <AvatarImage src={b.customer.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs">{b.customer.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{b.customer.name}</span>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Owner</p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {b.owner.avatarUrl && <AvatarImage src={b.owner.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs">{(b.owner.businessName || b.owner.name)?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{b.owner.businessName || b.owner.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {b.status === 'held' && isCustomer && (
                <Button className="w-full" onClick={() => handleAction('pay', () => apiFns.payBooking(b.id))} disabled={actionLoading === 'pay'}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Pay & confirm
                </Button>
              )}
              {b.status === 'confirmed' && isCustomer && (
                <Button className="w-full" onClick={() => handleAction('pickup', () => apiFns.pickupBooking(b.id))} disabled={actionLoading === 'pickup'}>
                  <Package className="mr-1.5 h-4 w-4" /> Mark as picked up
                </Button>
              )}
              {b.status === 'picked_up' && (isCustomer || isOwner) && (
                <Button className="w-full" onClick={() => handleAction('start-use', () => apiFns.startUseBooking(b.id))} disabled={actionLoading === 'start-use'}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Start using equipment
                </Button>
              )}
              {b.status === 'in_use' && isCustomer && (
                <Button className="w-full" onClick={() => handleAction('return', () => apiFns.returnBooking(b.id, { action: 'initiate' }))} disabled={actionLoading === 'return'}>
                  <Clock className="mr-1.5 h-4 w-4" /> Initiate return
                </Button>
              )}
              {b.status === 'return_pending' && isOwner && (
                <Button className="w-full" onClick={() => handleAction('return', () => apiFns.returnBooking(b.id, { action: 'confirm' }))} disabled={actionLoading === 'return'}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm return
                </Button>
              )}
              {b.status === 'returned' && isOwner && (
                <>
                  <Button className="w-full" onClick={() => handleAction('inspect-pass', () => apiFns.inspectBooking(b.id, true))} disabled={actionLoading === 'inspect-pass'}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Inspection passed
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleAction('inspect-fail', () => apiFns.inspectBooking(b.id, false))} disabled={actionLoading === 'inspect-fail'}>
                    <AlertCircle className="mr-1.5 h-4 w-4" /> Inspection failed
                  </Button>
                </>
              )}
              {b.status === 'inspected' && (
                <Button className="w-full" onClick={() => handleAction('complete', () => apiFns.completeBooking(b.id))} disabled={actionLoading === 'complete'}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Complete booking
                </Button>
              )}
              {b.status === 'completed' && (
                <Button className="w-full" onClick={() => setReviewOpen(true)}>
                  <Star className="mr-1.5 h-4 w-4" /> {isCustomer ? 'Review equipment' : 'Review customer'}
                </Button>
              )}
              {b.status === 'held' && isOwner && (
                <>
                  <Button className="w-full" onClick={() => handleAction('approve', () => apiFns.approveBooking(b.id, true))} disabled={actionLoading === 'approve'}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve booking
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => handleAction('reject', () => apiFns.approveBooking(b.id, false))} disabled={actionLoading === 'reject'}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </>
              )}
              {!['completed', 'cancelled'].includes(b.status) && (
                <>
                  <Button variant="outline" className="w-full" onClick={() => handleAction('cancel', () => apiFns.cancelBooking(b.id, 'Cancelled by user'))} disabled={actionLoading === 'cancel'}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancel booking
                  </Button>
                  {isCustomer && ['confirmed', 'picked_up', 'in_use'].includes(b.status) && (
                    <Button variant="outline" className="w-full" onClick={() => navigate('disputes', { bookingId: b.id })}>
                      <AlertCircle className="mr-1.5 h-4 w-4" /> Raise dispute
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review dialog */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setReviewOpen(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-bold">{isCustomer ? 'Review equipment' : 'Review customer'}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{isCustomer ? `Rate "${b.equipment.title}"` : `Rate ${b.customer.name}`}</p>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setReviewBusy(true)
              try {
                await apiFns.submitBookingReview(b.id, { rating: reviewForm.rating, title: reviewForm.title || null, body: reviewForm.body || null })
                toast.success('Review submitted!')
                setReviewOpen(false)
                setReviewForm({ rating: 5, title: '', body: '' })
                qc.invalidateQueries({ queryKey: ['booking', id] })
              } catch (err) {
                toast.error((err as ApiError).message)
              } finally {
                setReviewBusy(false)
              }
            }} className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: n })} className="transition hover:scale-110">
                      <Star className={cn('h-7 w-7', n <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/40')} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Title (optional)</p>
                <Input value={reviewForm.title} onChange={e => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="Great experience!" />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Your review</p>
                <Textarea rows={3} value={reviewForm.body} onChange={e => setReviewForm({ ...reviewForm, body: e.target.value })} placeholder="Share your experience…" />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setReviewOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={reviewBusy}>{reviewBusy ? 'Submitting…' : 'Submit review'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
