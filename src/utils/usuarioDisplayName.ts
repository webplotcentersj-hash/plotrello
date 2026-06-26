import { supabase } from '../services/supabaseClient'
import type { Usuario } from '../hooks/useAuth'
import type { UsuarioRecord } from '../types/api'
import { registerUsuariosLegajoDisplay } from './legajoDisplayRegistry'

export type LegajoNombreFields = {
  nombre?: string | null
  apellido?: string | null
}

/** Nombre y apellido del legajo (RRHH), sin email. */
export function nombreCompletoLegajo(legajo?: LegajoNombreFields | null): string | null {
  if (!legajo) return null
  const full = `${legajo.nombre?.trim() ?? ''} ${legajo.apellido?.trim() ?? ''}`.trim()
  return full || null
}

export function esNombreTipoEmail(value: string): boolean {
  return value.includes('@')
}

/** Fallback cuando aún no hay legajo cargado: nunca mostrar el email completo. */
export function fallbackNombreSinEmail(nombreLogin: string): string {
  const raw = nombreLogin.trim()
  if (!raw) return 'Usuario'
  if (!esNombreTipoEmail(raw)) return raw
  return raw.split('@')[0]!.trim() || 'Usuario'
}

/** Nombre visible en UI: legajo primero, nunca email como etiqueta principal. */
export function nombreVisibleUsuario(
  usuario?: Pick<Usuario, 'nombre' | 'nombreVisible'> | null
): string {
  if (!usuario) return 'Usuario'
  const visible = usuario.nombreVisible?.trim()
  if (visible) return visible
  return fallbackNombreSinEmail(usuario.nombre)
}

export async function fetchNombreLegajoUsuario(usuarioId: number): Promise<string | null> {
  if (!supabase || !Number.isFinite(usuarioId) || usuarioId <= 0) return null
  try {
    const { data, error } = await supabase
      .from('legajos_empleados')
      .select('nombre, apellido')
      .eq('id_usuario', usuarioId)
      .maybeSingle()
    if (error || !data) return null
    return nombreCompletoLegajo(data)
  } catch {
    return null
  }
}

/** Completa `nombreVisible` desde legajos_empleados (no modifica `nombre` de login). */
export async function enrichUsuarioConNombreLegajo(usuario: Usuario): Promise<Usuario> {
  const legajo = await fetchNombreLegajoUsuario(usuario.id)
  if (!legajo) return usuario
  if (usuario.nombreVisible === legajo) return usuario
  return { ...usuario, nombreVisible: legajo }
}

export function persistUsuarioNombreVisible(usuario: Usuario): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem('usuario', JSON.stringify(usuario))
  } catch {
    /* ignore quota */
  }
}

export type UsuarioRecordConVisible = UsuarioRecord & { nombre_visible?: string | null }

/** Nombre visible para registros de API (listas, tablero, RRHH). */
export function nombreVisibleDesdeRecord(
  usuario: Pick<UsuarioRecord, 'nombre'> & { nombre_visible?: string | null }
): string {
  const visible = usuario.nombre_visible?.trim()
  if (visible) return visible
  return fallbackNombreSinEmail(usuario.nombre)
}

/** Enriquece usuarios de API con nombre del legajo (batch). */
export async function enrichUsuariosRecordsConLegajo(
  usuarios: UsuarioRecord[]
): Promise<UsuarioRecordConVisible[]> {
  if (!supabase || usuarios.length === 0) return usuarios
  const ids = [...new Set(usuarios.map((u) => u.id).filter((id) => id > 0))]
  if (ids.length === 0) return usuarios
  try {
    const { data, error } = await supabase
      .from('legajos_empleados')
      .select('id_usuario, nombre, apellido')
      .in('id_usuario', ids)
    if (error || !data?.length) return usuarios
    const legajoPorId = new Map<number, string>()
    for (const row of data) {
      const uid = Number(row.id_usuario)
      const full = nombreCompletoLegajo(row)
      if (uid > 0 && full) legajoPorId.set(uid, full)
    }
    if (legajoPorId.size === 0) return usuarios
    const enriched = usuarios.map((u) => {
      const legajo = legajoPorId.get(u.id)
      return legajo ? { ...u, nombre_visible: legajo } : u
    })
    registerUsuariosLegajoDisplay(enriched)
    return enriched
  } catch {
    return usuarios
  }
}

/** Alias histórico (quitar dominio de email) — preferir nombreVisibleUsuario. */
export function sanitizeWorkerName(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (esNombreTipoEmail(trimmed)) return undefined
  return trimmed
}
