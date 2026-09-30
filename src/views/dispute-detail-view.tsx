'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { AlertCircle, ChevronLeft, Send, ShieldCheck, Scale } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function DisputeDetailView() {
  const id = useRouterStore((s) => s.params.id)
  const navigate = useRouterStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [message, setMessage] = useState('')

  const { data: dispute, isLoading } = useQuery({
    queryKey: ['dispute', id],
    queryFn: () => apiFns.getDispute(id!),
    enabled: !!id,
  })

  const d = dispute as {
    id: string; reason: string; description: string; status: string; resolution: string | null; resolutionNote: string | null; createdAt: string;
    booking: { id: string; equipment: { title: string; images: { url: string }[] }; customer: { name: string }; owner: { name: string; businessName: string | null } };
    raisedBy: { id: string; name: string; avatarUrl: string | null };
    against: { id: string; name: string; avatarUrl: string | null };
    messages: { id: string; message: string; isStaff: boolean; createdAt: string; sender: { id: string; name: string; avatarUrl: string | null } }[];
  } | undefined

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    try {
      await apiFns.sendDisputeMessage(id!, message)
      setMessage('')
      qc.invalidateQueries({ queryKey: ['dispute', id] })
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  async function resolve(resolution: string) {
    try {
      await apiFns.resolveDispute(id!, resolution)
      qc.invalidateQueries({ queryKey: ['dispute', id] })
      toast.success('Dispute resolved')
    } catch (err) {
      toast.error((err as ApiError).message)
    }
  }

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-8"><CardGridSkeleton count={2} /></div>
  if (!d) return <div className="mx-auto max-w-3xl px-4 py-12"><EmptyState title="Dispute not found" /></div>

  const isAdmin = user?.role === 'admin'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <button onClick={() => navigate('disputes')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to disputes
      </button>

      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold capitalize">{d.reason.replace(/_/g, ' ')}</h1>
          <p className="text-sm text-muted-foreground">{d.booking.equipment.title} · {formatDate(d.createdAt)}</p>
        </div>
      </div>

      {/* Description */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Issue description</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              {d.raisedBy.avatarUrl && <AvatarImage src={d.raisedBy.avatarUrl} alt="" />}
              <AvatarFallback className="text-xs">{d.raisedBy.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{d.raisedBy.name}</p>
              <p className="text-sm text-muted-foreground">{d.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Discussion</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rh-scroll">
            {d.messages.map((m) => (
              <div key={m.id} className={cn('flex gap-2', m.sender.id === user?.id && 'flex-row-reverse')}>
                <Avatar className="h-6 w-6 shrink-0">
                  {m.sender.avatarUrl && <AvatarImage src={m.sender.avatarUrl} alt="" />}
                  <AvatarFallback className="text-[10px]">{m.sender.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className={cn('max-w-[70%] rounded-lg p-2.5 text-sm', m.sender.id === user?.id ? 'bg-primary text-primary-foreground' : m.isStaff ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-muted')}>
                  {m.isStaff && <p className="mb-0.5 text-[10px] font-bold text-amber-600">ADMIN</p>}
                  <p>{m.message}</p>
                  <p className={cn('mt-0.5 text-[10px]', m.sender.id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{formatDateTime(m.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {d.status !== 'resolved' && d.status !== 'closed' && (
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a message…" className="h-9" />
              <Button type="submit" size="icon" disabled={!message.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Resolution */}
      {d.status === 'resolved' ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-emerald-600"><ShieldCheck className="h-4 w-4" /> Resolved</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm"><span className="font-medium capitalize">Resolution:</span> {d.resolution?.replace(/_/g, ' ')}</p>
            {d.resolutionNote && <p className="mt-1 text-sm text-muted-foreground">{d.resolutionNote}</p>}
          </CardContent>
        </Card>
      ) : isAdmin ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4" /> Admin resolution</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => resolve('refund_customer')}>Refund customer</Button>
            <Button size="sm" variant="outline" onClick={() => resolve('favor_owner')}>Favor owner</Button>
            <Button size="sm" variant="outline" onClick={() => resolve('split')}>Split</Button>
            <Button size="sm" variant="outline" onClick={() => resolve('warning')}>Warning only</Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Awaiting resolution…</p>
      )}
    </div>
  )
}
