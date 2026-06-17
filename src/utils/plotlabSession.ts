import { isOperarioExternoRol } from '../features/work-pool/workPoolOperarioExterno'
import type { Usuario } from '../hooks/useAuth'

export const PLOTLAB_SESSION_KIND_KEY = 'plotlab_session_kind'

export type PlotlabSessionKind = 'staff' | 'operario_externo'

export const PLOTLAB_USUARIO_STORAGE_KEY = 'usuario'
export const PLOTLAB_SESSION_KIND_STORAGE_KEY = PLOTLAB_SESSION_KIND_KEY

const USUARIO_KEY = PLOTLAB_USUARIO_STORAGE_KEY
const USUARIO_ID_KEY = 'usuario_id'
const AUTH_TOKEN_KEY = 'auth_token'
const LOGIN_USER_KEY = 'plotlab_login_usuario'
const STAFF_JWT_STATUS_CACHE_KEY = 'plotlab_staff_jwt_enabled'

function parseStoredUsuario(): Usuario | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USUARIO_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Usuario
  } catch {
    return null
  }
}

export function getSessionKind(): PlotlabSessionKind | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(PLOTLAB_SESSION_KIND_KEY)
  if (stored === 'staff' || stored === 'operario_externo') return stored
  const usuario = parseStoredUsuario()
  if (!usuario) return null
  return isOperarioExternoRol(usuario.rol) ? 'operario_externo' : 'staff'
}

export function clearAllPlotlabSessions(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(USUARIO_KEY)
  localStorage.removeItem(USUARIO_ID_KEY)
  localStorage.removeItem(LOGIN_USER_KEY)
  localStorage.removeItem(PLOTLAB_SESSION_KIND_KEY)
}

/** Limpieza completa y síncrona de credenciales Plot Lab (local + sessionStorage). */
export function clearPlotlabAuthStorage(): void {
  clearAllPlotlabSessions()
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(STAFF_JWT_STATUS_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export function persistStaffSession(
  usuario: Usuario,
  opts?: { token?: string; loginName?: string }
): void {
  clearPlotlabAuthStorage()
  localStorage.setItem(PLOTLAB_SESSION_KIND_KEY, 'staff')
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
  localStorage.setItem(USUARIO_ID_KEY, String(usuario.id))
  if (opts?.loginName) localStorage.setItem(LOGIN_USER_KEY, opts.loginName)
  if (opts?.token) localStorage.setItem(AUTH_TOKEN_KEY, opts.token)
}

export function persistOperarioExternoSession(
  usuario: Usuario,
  opts?: { token?: string; loginName?: string }
): void {
  clearPlotlabAuthStorage()
  localStorage.setItem(PLOTLAB_SESSION_KIND_KEY, 'operario_externo')
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
  localStorage.setItem(USUARIO_ID_KEY, String(usuario.id))
  if (opts?.loginName) localStorage.setItem(LOGIN_USER_KEY, opts.loginName)
  if (opts?.token) localStorage.setItem(AUTH_TOKEN_KEY, opts.token)
}

/** Usuario en storage sin filtrar por ámbito (legacy). */
export function readStoredUsuario(): Usuario | null {
  return parseStoredUsuario()
}

/** Solo sesión Plot Lab staff (nunca operario externo). */
export function readStaffUsuario(): Usuario | null {
  const usuario = parseStoredUsuario()
  if (!usuario || isOperarioExternoRol(usuario.rol)) return null
  const kind = getSessionKind()
  if (kind === 'operario_externo') return null
  return usuario
}

/** Solo sesión operario externo aprobado. */
export function readOperarioExternoUsuario(): Usuario | null {
  const usuario = parseStoredUsuario()
  if (!usuario || !isOperarioExternoRol(usuario.rol)) return null
  const kind = getSessionKind()
  if (kind === 'staff') return null
  return usuario
}

export function isStaffSession(): boolean {
  return readStaffUsuario() != null
}

export function isOperarioExternoSession(): boolean {
  return readOperarioExternoUsuario() != null
}
