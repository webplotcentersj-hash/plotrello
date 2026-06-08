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
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(USUARIO_KEY)
  localStorage.removeItem('usuario_id')
  localStorage.removeItem('plotlab_login_usuario')
}

/** true si PLOT_LAB_STAFF_JWT_SECRET está configurado en Vercel. */
export async function isStaffJwtEnabledOnServer(): Promise<boolean> {
  try {
    const resp = await fetch('/api/auth/staff-jwt-status')
    if (!resp.ok) return false
    const json = (await resp.json()) as { enabled?: boolean }
    return json.enabled === true
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
    const resp = await fetch('/api/auth/staff-session', {
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
      localStorage.setItem(USUARIO_KEY, JSON.stringify(json.usuario))
      localStorage.setItem('usuario_id', String(json.usuario.id))
    }
    return { ok: true, usuario: json.usuario }
  } catch {
    return { ok: false }
  }
}
