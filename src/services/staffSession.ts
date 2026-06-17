import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { clearPlotlabAuthStorage } from '../utils/plotlabSession'

const AUTH_TOKEN_KEY = 'auth_token'
const USUARIO_KEY = 'usuario'

export function getStaffAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStaffAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStaffSession(): void {
  clearPlotlabAuthStorage()
}

const STAFF_JWT_STATUS_CACHE_KEY = 'plotlab_staff_jwt_enabled'

/** true si PLOT_LAB_STAFF_JWT_SECRET está configurado en Vercel. */
export async function isStaffJwtEnabledOnServer(): Promise<boolean> {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const cached = sessionStorage.getItem(STAFF_JWT_STATUS_CACHE_KEY)
      if (cached === '1') return true
      if (cached === '0') return false
    }
    const resp = await plotLabFetch('/api/auth/staff-jwt-status')
    if (!resp.ok) return false
    const json = (await resp.json()) as { enabled?: boolean }
    const enabled = json.enabled === true
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STAFF_JWT_STATUS_CACHE_KEY, enabled ? '1' : '0')
    }
    return enabled
  } catch {
    return false
  }
}

/** Verifica JWT staff con el servidor (firma + expiración). */
export async function verifyStaffSession(): Promise<{
  ok: boolean
  usuario?: { id: number; nombre: string; rol: string }
}> {
  const token = getStaffAuthToken()
  if (!token) return { ok: false }

  try {
    const resp = await plotLabFetch('/api/auth/staff-session', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.status === 503) {
      // JWT no configurado en servidor — sesión legacy sin token sigue válida
      return { ok: true }
    }
    if (!resp.ok) return { ok: false }
    const json = (await resp.json()) as {
      usuario?: { id: number; nombre: string; rol: string }
    }
    if (json.usuario) {
      const kind = localStorage.getItem('plotlab_session_kind')
      localStorage.setItem(USUARIO_KEY, JSON.stringify(json.usuario))
      localStorage.setItem('usuario_id', String(json.usuario.id))
      if (kind === 'staff' || kind === 'operario_externo') {
        localStorage.setItem('plotlab_session_kind', kind)
      }
    }
    return { ok: true, usuario: json.usuario }
  } catch {
    return { ok: false }
  }
}
