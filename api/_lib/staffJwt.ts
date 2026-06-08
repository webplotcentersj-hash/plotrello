import crypto from 'crypto'

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

export type StaffJwtPayload = {
  sub: number
  nombre: string
  rol: string
  typ: 'staff'
  iat: number
  exp: number
}

const DEFAULT_TTL_SEC = 12 * 60 * 60 // 12 h — turno laboral

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64url')
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

export function getStaffJwtSecret(): string {
  const secret = (process.env.PLOT_LAB_STAFF_JWT_SECRET || '').trim()
  if (secret) return secret
  if (isProduction()) return ''
  return 'plotlab-dev-staff-jwt-not-for-production'
}

export function isStaffJwtConfigured(): boolean {
  return Boolean(getStaffJwtSecret())
}

export function signStaffJwt(usuario: { id: number; nombre: string; rol: string }, ttlSec = DEFAULT_TTL_SEC): string {
  const secret = getStaffJwtSecret()
  if (!secret) throw new Error('PLOT_LAB_STAFF_JWT_SECRET no configurado')

  const now = Math.floor(Date.now() / 1000)
  const payload: StaffJwtPayload = {
    sub: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    typ: 'staff',
    iat: now,
    exp: now + ttlSec
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyStaffJwt(token: string): StaffJwtPayload | null {
  const secret = getStaffJwtSecret()
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, sig] = parts
  const data = `${header}.${body}`
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as StaffJwtPayload
    if (payload.typ !== 'staff' || !payload.sub || !payload.rol) return null
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}
