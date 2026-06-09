import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyStaffJwt, type StaffJwtPayload } from './staffJwt'

/** Producción Vercel o NODE_ENV=production */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

export function getBearerToken(req: VercelRequest): string {
  const h = String(req.headers.authorization || '')
  const m = h.match(/^Bearer\s+(.+)$/i)
  return (m?.[1] || '').trim()
}

/**
 * Exige Bearer token. En producción sin token configurado → 503 (fail-closed).
 * En preview/dev sin token → permite (solo para desarrollo local).
 */
export function requireBearerSecret(
  req: VercelRequest,
  res: VercelResponse,
  envName: string,
  opts?: { allowDevWithoutSecret?: boolean }
): boolean {
  const expected = (process.env[envName] || '').trim()
  if (!expected) {
    if (isProduction() || !opts?.allowDevWithoutSecret) {
      res.status(503).json({
        error: `${envName} no configurado. Endpoint deshabilitado en producción.`
      })
      return false
    }
    return true
  }
  const got = getBearerToken(req)
  if (!got || got !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

/** CORS restrictivo: origen permitido o mismo host. Evita * en endpoints sensibles. */
export function setCorsRestricted(req: VercelRequest, res: VercelResponse, methods = 'GET, POST, OPTIONS'): void {
  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS || 'https://plotrello.vercel.app,https://trello.plotcenter.com.ar')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

/** Supabase server: nunca usar VITE_* como fallback de service role en producción. */
export function getSupabaseServerKey(): string {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (service) return service
  if (isProduction()) return ''
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
}

export function getSupabaseServerUrl(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
}

/** Clave Gemini solo server-side (nunca VITE_ en producción). */
/** Clave Gemini solo server-side. Acepta GEMINI_API_KEY o VITE_GEMINI_API_KEY (Vercel). */
export function getGeminiServerKey(): string {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://trello.plotcenter.com.ar',
  'https://plotrello.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]

/** Request desde el frontend PlotLab (mismo sitio). No reemplaza JWT; evita exponer secret en el bundle. */
export function isPlotLabSameOrigin(req: VercelRequest): boolean {
  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '').trim()
  const referer = String(req.headers.referer || '').trim()
  if (origin && allowed.some((a) => origin === a || origin.startsWith(a))) return true
  if (referer && allowed.some((a) => referer.startsWith(a))) return true
  return false
}

/**
 * Auth para notify-orden-lista: Bearer secret (webhooks) o mismo origen PlotLab en producción.
 */
/** Valida JWT staff (Bearer). Devuelve payload o null y responde 401. */
export function requireStaffSession(
  req: VercelRequest,
  res: VercelResponse
): StaffJwtPayload | null {
  const token = getBearerToken(req)
  const payload = verifyStaffJwt(token)
  if (!payload) {
    res.status(401).json({ error: 'Sesión staff inválida o expirada' })
    return null
  }
  return payload
}

export function authorizeNotifyOrdenLista(req: VercelRequest, res: VercelResponse): boolean {
  const expected = (process.env.NOTIFY_ORDEN_WEBHOOK_SECRET || '').trim()
  if (expected) {
    const got = getBearerToken(req)
    if (got && got === expected) return true
  }
  if (!isProduction()) return true
  if (isPlotLabSameOrigin(req)) return true
  res.status(401).json({ error: 'Unauthorized' })
  return false
}
