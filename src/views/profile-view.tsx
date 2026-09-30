'use client'

import { useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Shield, BadgeCheck, Building2, Camera, Save, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'

export function ProfileView() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    accountType: user?.accountType || 'individual',
    businessName: user?.businessName || '',
    registrationNumber: user?.registrationNumber || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  if (!user) return null

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploading(true)
    try {
      const updated = await apiFns.uploadAvatar(file)
      setUser(updated)
      toast.success('Avatar updated')
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setUploading(false)
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await apiFns.updateProfile(form)
      setUser(updated)
      toast.success('Profile saved')
    } catch (err) {
      toast.error((err as ApiError).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Your profile</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* Avatar card */}
        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="relative mx-auto w-fit">
            <Avatar className="h-24 w-24 border-4">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || ''} />}
              <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">{(user.name || user.email).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow"
              aria-label="Change avatar"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
          </div>
          <h2 className="mt-4 font-semibold">{user.name || 'Account'}</h2>
          <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {user.email}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Badge variant="secondary" className="capitalize"><Shield className="mr-1 h-3 w-3" /> {user.role}</Badge>
            {user.isVerified && <Badge variant="secondary" className="text-emerald-600"><BadgeCheck className="mr-1 h-3 w-3" /> Verified</Badge>}
            {user.businessName && <Badge variant="secondary"><Building2 className="mr-1 h-3 w-3" /> {user.businessName}</Badge>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Member since {formatDate(user.createdAt)}</p>
        </div>

        {/* Edit form */}
        <form onSubmit={onSave} className="space-y-4 rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Edit details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="pl-9" placeholder="+91 90000 00000" />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell renters about yourself…" rows={3} />
          </div>

          {user.role === 'owner' && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-sm font-medium">Owner details</p>
              <div className="space-y-1.5">
                <Label htmlFor="at">Account type</Label>
                <Select value={form.accountType || 'individual'} onValueChange={(v) => setForm({ ...form, accountType: v })}>
                  <SelectTrigger id="at"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="biz">Business name</Label>
                  <Input id="biz" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg">Registration no.</Label>
                  <Input id="reg" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => refreshUser()}>Discard</Button>
            <Button type="submit" disabled={saving}><Save className="mr-1.5 h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
