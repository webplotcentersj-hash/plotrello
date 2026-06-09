import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { supabase } from './supabaseClient'
import { isStaffJwtEnabledOnServer } from './staffSession'
import type { UsuarioRecord } from '../types/api'

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

const LEGACY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const hasLegacyBackend = Boolean(LEGACY_API_BASE_URL)

async function fetchStaffToken(usuario: string, password: string): Promise<string | undefined> {
  try {
    const resp = await plotLabFetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    })

    if (resp.status === 503) return undefined

    const json = (await resp.json().catch(() => ({}))) as { token?: string; error?: string }

    if (!resp.ok) {
      console.warn('[login] staff-login sin token:', resp.status, json.error)
      return undefined
    }

    return typeof json.token === 'string' ? json.token : undefined
  } catch (err) {
    console.warn('[login] staff-login error:', err)
    return undefined
  }
}

async function getInactiveUsuarioLoginHint(usuario: string): Promise<string | null> {
  if (!supabase) return null
  const trimmed = usuario.trim()
  if (!trimmed) return null
  try {
    const { data, error } = await supabase.rpc('usuario_inactivo_login_hint', {
      p_usuario: trimmed
    })
    if (error || data !== true) return null
    return 'Tu usuario fue dado de baja. Contactá a Recursos Humanos si necesitás acceso.'
  } catch {
    return null
  }
}

async function ensureUsuarioExists(id: number, nombre: string, rol: string): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.rpc('sync_usuario_notificacion', {
      p_id: id,
      p_nombre: nombre,
      p_rol: rol
    })
    if (error) console.error('sync_usuario_notificacion:', error)
  } catch (error) {
    console.error('Excepción en ensureUsuarioExists:', error)
  }
}

async function finalizeStaffLogin(
  usuarioDb: UsuarioRecord,
  token?: string,
  loginName?: string
): Promise<ApiResponse<{ usuario: UsuarioRecord }>> {
  await ensureUsuarioExists(usuarioDb.id, usuarioDb.nombre, usuarioDb.rol)
  localStorage.setItem('usuario', JSON.stringify(usuarioDb))
  localStorage.setItem('usuario_id', usuarioDb.id.toString())
  if (loginName) localStorage.setItem('plotlab_login_usuario', loginName)
  if (token) localStorage.setItem('auth_token', token)
  return { success: true, data: { usuario: usuarioDb } }
}

async function legacyRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  if (!LEGACY_API_BASE_URL) {
    return { success: false, error: 'Backend legacy no configurado' }
  }

  const token = localStorage.getItem('auth_token')

  try {
    const response = await fetch(`${LEGACY_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(
        errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`
      )
    }

    return (await response.json()) as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    }
  }
}

export async function staffLogin(
  usuario: string,
  password: string
): Promise<ApiResponse<{ usuario: UsuarioRecord }>> {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('login_usuario', {
        p_usuario: usuario,
        p_password: password
      })

      if (error) {
        console.error('Error en login_usuario RPC:', error)
        return { success: false, error: `Error de autenticación: ${error.message}` }
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn('Login fallido: credenciales inválidas o usuario no encontrado')
        const inactiveMsg = await getInactiveUsuarioLoginHint(usuario)
        return {
          success: false,
          error:
            inactiveMsg ||
            'Usuario o contraseña incorrectos. Si tu usuario fue dado de baja, contactá a RRHH.'
        }
      }

      const usuarioDb = Array.isArray(data) ? data[0] : data

      if (!usuarioDb || !usuarioDb.id) {
        console.error('Login fallido: datos de usuario inválidos', usuarioDb)
        return { success: false, error: 'Error al obtener datos del usuario' }
      }

      const token = await fetchStaffToken(usuario, password)
      if (!token) {
        try {
          const jwtOn = await isStaffJwtEnabledOnServer()
          if (jwtOn) {
            return {
              success: false,
              error:
                'Contraseña correcta, pero no se pudo abrir sesión segura. Entrá desde trello.plotcenter.com.ar o contactá soporte.'
            }
          }
        } catch {
          /* seguir sin JWT */
        }
      }

      return finalizeStaffLogin(usuarioDb as UsuarioRecord, token, usuario.trim())
    } catch (err) {
      console.error('Excepción en login:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error inesperado al iniciar sesión'
      }
    }
  }

  if (hasLegacyBackend) {
    return legacyRequest<{ usuario: UsuarioRecord }>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ usuario, password })
    })
  }

  const mockUsuario: UsuarioRecord = {
    id: 1,
    nombre: usuario || 'Dev',
    rol: 'administracion'
  }

  localStorage.setItem('usuario', JSON.stringify(mockUsuario))
  return { success: true, data: { usuario: mockUsuario } }
}

export async function staffLogout(): Promise<ApiResponse<void>> {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('usuario')

  if (supabase) {
    await supabase.rpc('logout_usuario')
    return { success: true }
  }

  if (hasLegacyBackend) {
    return legacyRequest<void>('/auth/logout.php', { method: 'POST' })
  }

  return { success: true }
}
