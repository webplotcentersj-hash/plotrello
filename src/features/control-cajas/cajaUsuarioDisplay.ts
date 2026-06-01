import { DEFAULT_CAJERAS } from './constants'
import type { CajaCajera } from './types'

/** Nombre legible de quien opera caja (maestros cajeras o login sin @). */
export function resolveUsuarioCajaEtiqueta(
  usuarioNombre: string,
  cajeras: CajaCajera[] = DEFAULT_CAJERAS
): string {
  const raw = usuarioNombre.trim()
  if (!raw) return 'Usuario'

  const loginGuardado =
    typeof localStorage !== 'undefined' ? localStorage.getItem('plotlab_login_usuario')?.trim() : ''
  const loginKey = raw.includes('@') ? raw.split('@')[0]!.trim() : raw

  if (loginGuardado) {
    const porLogin = cajeras.find((c) => c.usuario.toLowerCase() === loginGuardado.toLowerCase())
    if (porLogin) return porLogin.nombre
  }

  for (const c of cajeras) {
    if (c.usuario.toLowerCase() === loginKey.toLowerCase()) return c.nombre
    if (c.usuario.toLowerCase() === raw.toLowerCase()) return c.nombre
    if (c.nombre.toLowerCase() === raw.toLowerCase()) return c.nombre
  }

  if (raw.includes('@')) return loginKey
  return raw
}
