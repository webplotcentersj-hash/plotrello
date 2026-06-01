import { DEFAULT_CAJERAS } from './constants'
import type { CajaCajera } from './types'

const CAJA_SLUG_STORAGE_PREFIX = 'plotlab_caja_slug_'

/** Claves de login para cruzar con Maestros → Cajeras (campo usuario). */
export function getPlotlabLoginKeys(usuarioNombre: string): string[] {
  const keys: string[] = []
  const raw = usuarioNombre.trim()
  if (!raw) return keys

  const loginGuardado =
    typeof localStorage !== 'undefined' ? localStorage.getItem('plotlab_login_usuario')?.trim() : ''
  if (loginGuardado) keys.push(loginGuardado)
  if (raw.includes('@')) keys.push(raw.split('@')[0]!.trim())
  keys.push(raw)

  return [...new Set(keys.map((k) => k.toLowerCase()).filter(Boolean))]
}

export function getStoredCajaSlug(usuarioId?: number): string | null {
  if (!usuarioId || typeof localStorage === 'undefined') return null
  const slug = localStorage.getItem(`${CAJA_SLUG_STORAGE_PREFIX}${usuarioId}`)
  return slug?.trim() || null
}

export function setStoredCajaSlug(usuarioId: number, slug: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`${CAJA_SLUG_STORAGE_PREFIX}${usuarioId}`, slug.trim())
}

/** Nombre legible de quien opera caja (maestros cajeras o login sin @). */
export function resolveUsuarioCajaEtiqueta(
  usuarioNombre: string,
  cajeras: CajaCajera[] = DEFAULT_CAJERAS
): string {
  const raw = usuarioNombre.trim()
  if (!raw) return 'Usuario'

  const loginKeys = getPlotlabLoginKeys(raw)

  for (const c of cajeras) {
    const cu = c.usuario.trim().toLowerCase()
    if (loginKeys.some((k) => k === cu)) return c.nombre
    if (c.nombre.toLowerCase() === raw.toLowerCase()) return c.nombre
  }

  for (const k of loginKeys) {
    const porNombre = cajeras.find((c) => c.nombre.toLowerCase().includes(k))
    if (porNombre) return porNombre.nombre
  }

  if (raw.includes('@')) return raw.split('@')[0]!.trim()
  return raw
}
