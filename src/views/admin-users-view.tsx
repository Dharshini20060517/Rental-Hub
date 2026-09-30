'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardGridSkeleton } from '@/components/shared/states'
import { EmptyState } from '@/components/shared/feedback'
import { Search, ShieldCheck, Ban, CheckCircle2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'

type UserRow = {
  id: string; email: string; name: string | null; role: string; accountType: string | null;
  businessName: string | null; avatarUrl: string | null; isVerified: boolean; isSuspended: boolean; lastLoginAt: string | null; createdAt: string
}

export function AdminUsersView() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ rows: UserRow[]; total: number }>({
    queryKey: ['admin-users', q, role],
    queryFn: async () => {
      const { api } = await import('@/lib/api-client')
      const res = await api.get('/admin/users', { params: { limit: 50, q, role: role === 'all' ? undefined : role } })
      return { rows: (res.data.data || []) as UserRow[], total: res.data.meta?.total ?? 0 }
    },
  })

  async function update(id: string, patch: { isVerified?: boolean; isSuspended?: boolean; role?: string }) {
    setBusyId(id)
    try {
      await apiFns.adminUpdateUser(id, patch)
      qc.invalidateQueries({ queryKey: ['admin-users', q, role] })
      toast.success('User updated')
    } catch (err) { toast.error((err as ApiError).message) } finally { setBusyId(null) }
  }

  const rows = data?.rows || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Users className="h-6 w-6 text-primary" /> User management</h1>
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} users · verify, suspend, change roles</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, business…" className="pl-9" />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="owner">Owners</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <CardGridSkeleton count={3} /> : rows.length === 0 ? <EmptyState title="No users found" icon={Users} /> : (
        <div className="overflow-x-auto rh-scroll rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 text-left backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Joined</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b transition last:border-0 hover:bg-primary/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                        <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">{(u.name || u.email).charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name || '—'}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={u.role} onValueChange={(v) => update(u.id, { role: v })} disabled={busyId === u.id}>
                      <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.isVerified ? <Badge variant="secondary" className="text-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" /> Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                      {u.isSuspended && <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" /> Suspended</Badge>}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {!u.isVerified && <Button size="sm" variant="outline" className="h-7" disabled={busyId === u.id} onClick={() => update(u.id, { isVerified: true })}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Verify</Button>}
                      <Button size="sm" variant={u.isSuspended ? 'outline' : 'ghost'} className={`h-7 ${u.isSuspended ? '' : 'text-destructive hover:text-destructive'}`} disabled={busyId === u.id} onClick={() => update(u.id, { isSuspended: !u.isSuspended })}>
                        {u.isSuspended ? 'Reactivate' : 'Suspend'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
