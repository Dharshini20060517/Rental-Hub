'use client'

import { useState } from 'react'
import { useRouterStore } from '@/store/router'
import { useAuthStore } from '@/store/auth'
import { apiFns, type ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Wrench, ShieldCheck, Mail, Lock, User as UserIcon, Building2, ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <button onClick={() => useRouterStore.getState().navigate('home')} className="mb-4 inline-flex items-center gap-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Wrench className="h-6 w-6" />
          </div>
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  )
}

function DemoAccounts() {
  const navigate = useRouterStore((s) => s.navigate)
  const params = useRouterStore((s) => s.params)
  const login = useAuthStore((s) => s.login)
  async function quick(email: string, pw: string) {
    try {
      await login(email, pw)
      toast.success('Welcome back!')
      const redirect = params.redirect as string | undefined
      if (redirect) {
        const redirectParams: Record<string, string> = {}
        if (params.id) redirectParams.id = params.id
        if (params.equipmentId) redirectParams.equipmentId = params.equipmentId
        if (params.startDate) redirectParams.startDate = params.startDate
        if (params.endDate) redirectParams.endDate = params.endDate
        navigate(redirect as never, redirectParams)
      } else navigate('home')
    } catch {
      toast.error('Demo login failed')
    }
  }
  return (
    <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Demo accounts</p>
      <div className="grid grid-cols-3 gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-auto flex-col py-1.5 text-[11px]" onClick={() => quick('admin@rentalhub.test', 'Admin123!')}>Admin</Button>
        <Button type="button" variant="outline" size="sm" className="h-auto flex-col py-1.5 text-[11px]" onClick={() => quick('rohit@rentalhub.test', 'Owner123!')}>Owner</Button>
        <Button type="button" variant="outline" size="sm" className="h-auto flex-col py-1.5 text-[11px]" onClick={() => quick('rahul@rentalhub.test', 'Customer123!')}>Customer</Button>
      </div>
    </div>
  )
}

export function LoginView() {
  const navigate = useRouterStore((s) => s.navigate)
  const params = useRouterStore((s) => s.params)
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      const redirect = params.redirect as string | undefined
      if (redirect) {
        // Pass all relevant params back to the redirect view
        const redirectParams: Record<string, string> = {}
        if (params.id) redirectParams.id = params.id
        if (params.equipmentId) redirectParams.equipmentId = params.equipmentId
        if (params.startDate) redirectParams.startDate = params.startDate
        if (params.endDate) redirectParams.endDate = params.endDate
        navigate(redirect as never, redirectParams)
      } else navigate('home')
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage rentals and listings.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" onClick={() => navigate('reset-password')} className="text-xs text-primary hover:underline">Forgot password?</button>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" />
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : <>Sign in <ArrowRight className="ml-1.5 h-4 w-4" /></>}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to RentalHub?{' '}
          <button type="button" onClick={() => navigate('register')} className="font-medium text-primary hover:underline">Create an account</button>
        </p>
      </form>
      <DemoAccounts />
    </AuthShell>
  )
}

export function RegisterView() {
  const navigate = useRouterStore((s) => s.navigate)
  const params = useRouterStore((s) => s.params)
  const register = useAuthStore((s) => s.register)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: (params.role as 'customer' | 'owner') || 'customer',
    accountType: 'individual',
    businessName: '',
    phone: '',
    agree: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.agree) { setError('Please accept the terms to continue.'); return }
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name, email: form.email, password: form.password, role: form.role, phone: form.phone,
      }
      if (form.role === 'owner') {
        payload.accountType = form.accountType
        if (form.accountType === 'business') payload.businessName = form.businessName
      }
      await register(payload)
      toast.success('Account created! Welcome to RentalHub.')
      navigate('home')
    } catch (err) {
      setError((err as ApiError).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Rent equipment or list your own — it's free to start.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['customer', 'owner'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r }))}
              className={cn('rounded-lg border p-3 text-left transition', form.role === r ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')}
            >
              <p className="text-sm font-semibold capitalize">{r}</p>
              <p className="text-xs text-muted-foreground">{r === 'customer' ? 'Rent equipment' : 'List & earn'}</p>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" className="pl-9" />
          </div>
        </div>
        {form.role === 'owner' && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <Label className="text-xs">Account type</Label>
            <Select value={form.accountType} onValueChange={(v) => setForm({ ...form, accountType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual owner</SelectItem>
                <SelectItem value="business">Business / company</SelectItem>
              </SelectContent>
            </Select>
            {form.accountType === 'business' && (
              <div className="space-y-1.5">
                <Label htmlFor="biz" className="text-xs">Business name</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="biz" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Acme Rentals LLP" className="pl-9" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">Phone (optional)</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 90000 00000" />
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.agree} onCheckedChange={(c) => setForm({ ...form, agree: !!c })} />
          <span className="text-muted-foreground">I agree to the Terms & Privacy Policy</span>
        </label>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account…' : <>Create account <ArrowRight className="ml-1.5 h-4 w-4" /></>}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('login')} className="font-medium text-primary hover:underline">Sign in</button>
        </p>
      </form>
    </AuthShell>
  )
}

export function ResetPasswordView() {
  const navigate = useRouterStore((s) => s.navigate)
  const params = useRouterStore((s) => s.params)
  const token = params.token
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function onRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiFns.forgotPassword(email)
      setSent(true)
      toast.success('If that email exists, a reset link was generated.')
    } catch {
      setError('Could not process request')
    } finally {
      setLoading(false)
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiFns.resetPassword(token!, password)
      setDone(true)
      toast.success('Password reset. You can now log in.')
      setTimeout(() => navigate('login'), 1200)
    } catch {
      setError('Invalid or expired token')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="We'll email you a secure link to reset your password.">
      {done ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Password updated. Redirecting to login…</div>
      ) : token ? (
        <form onSubmit={onReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="np" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className="pl-9" />
            </div>
          </div>
          {error && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {error}</div>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Resetting…' : 'Reset password'}</Button>
        </form>
      ) : sent ? (
        <div className="space-y-4 py-2 text-center text-sm text-muted-foreground">
          <p>If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link has been generated.</p>
          <p className="text-xs">In development, the link is printed to the server console. Paste the token below to continue.</p>
          <Button variant="outline" onClick={() => setSent(false)}>Use a different email</Button>
        </div>
      ) : (
        <form onSubmit={onRequest} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="re">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="re" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
            </div>
          </div>
          {error && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {error}</div>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Sending…' : 'Send reset link'}</Button>
          <p className="text-center text-sm text-muted-foreground">
            <button type="button" onClick={() => navigate('login')} className="font-medium text-primary hover:underline">Back to login</button>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
