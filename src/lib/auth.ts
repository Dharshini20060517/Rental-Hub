import { cookies } from 'next/headers'
import crypto from 'crypto'

// ---- JWT (HS256) implemented with Node crypto to avoid extra deps ----

const SECRET = process.env.JWT_SECRET || 'rentalhub_dev_secret_change_me_in_production_9f3a2c8b7e'
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900)
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 604800)

export interface JwtPayload {
  sub: string
  role: string
  type: 'access' | 'refresh'
  iat: number
  exp: number
  jti?: string
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: Omit<JwtPayload, 'iat' | 'exp'>, ttl: number): string {
  const now = Math.floor(Date.now() / 1000)
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttl }
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(full))
  const data = `${header}.${body}`
  const sig = base64Url(crypto.createHmac('sha256', SECRET).update(data).digest())
  return `${data}.${sig}`
}

export function signAccessToken(sub: string, role: string) {
  return sign({ sub, role, type: 'access' }, ACCESS_TTL)
}

export function signRefreshToken(sub: string, role: string) {
  return sign({ sub, role, type: 'refresh', jti: crypto.randomUUID() }, REFRESH_TTL)
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const expectedSig = base64Url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest())
    // timing-safe compare
    if (sig.length !== expectedSig.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ---- bcrypt (lazy import; falls back to scrypt-based hash if bcrypt fails) ----

let _bcrypt: typeof import('bcryptjs') | null = null
async function getBcrypt() {
  if (_bcrypt) return _bcrypt
  try {
    _bcrypt = await import('bcryptjs')
  } catch {
    // Fallback: native crypto scrypt
    _bcrypt = null as unknown as typeof import('bcryptjs')
  }
  return _bcrypt
}

export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await getBcrypt()
  if (bcrypt) return bcrypt.hash(plain, 10)
  // scrypt fallback
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    if (stored.startsWith('scrypt$')) {
      const [, salt, hash] = stored.split('$')
      const test = crypto.scryptSync(plain, salt, 64).toString('hex')
      return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash))
    }
    const bcrypt = await getBcrypt()
    if (!bcrypt) return false
    return bcrypt.compare(plain, stored)
  } catch {
    return false
  }
}

// ---- Cookie helpers ----

export const COOKIE_ACCESS = 'rh_access'
export const COOKIE_REFRESH = 'rh_refresh'

const cookieDefaults = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookies.set(COOKIE_ACCESS, accessToken, { ...cookieDefaults, maxAge: ACCESS_TTL })
  res.cookies.set(COOKIE_REFRESH, refreshToken, { ...cookieDefaults, maxAge: REFRESH_TTL })
}

export function clearAuthCookies(res: Response) {
  res.cookies.set(COOKIE_ACCESS, '', { ...cookieDefaults, maxAge: 0 })
  res.cookies.set(COOKIE_REFRESH, '', { ...cookieDefaults, maxAge: 0 })
}

// ---- Session helper for route handlers ----

export type SessionUser = {
  id: string
  role: string
} | null

export async function getSession(): Promise<SessionUser> {
  const store = await cookies()
  const access = store.get(COOKIE_ACCESS)?.value
  if (access) {
    const p = verifyToken(access)
    if (p && p.type === 'access') return { id: p.sub, role: p.role }
  }
  const refresh = store.get(COOKIE_REFRESH)?.value
  if (refresh) {
    const p = verifyToken(refresh)
    if (p && p.type === 'refresh') return { id: p.sub, role: p.role }
  }
  return null
}

export async function getAccessCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(COOKIE_ACCESS)?.value
}
export async function getRefreshCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(COOKIE_REFRESH)?.value
}
