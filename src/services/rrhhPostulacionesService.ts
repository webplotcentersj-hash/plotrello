import { supabase } from './supabaseClient'
import { formatSupabaseStatementTimeoutError } from '../utils/supabaseErrors'
import type { RrhhPostulacion, RrhhPostulacionEstado } from '../types/api'

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return formatSupabaseStatementTimeoutError((e as { message: string }).message)
  }
  return fallback
}

function mapRow(row: Record<string, unknown>): RrhhPostulacion {
  return {
    id: Number(row.id),
    legacy_id: row.legacy_id == null ? null : Number(row.legacy_id),
    nombre: String(row.nombre || ''),
    email: String(row.email || ''),
    telefono: row.telefono == null ? null : String(row.telefono),
    puesto: String(row.puesto || ''),
    categoria_puesto: row.categoria_puesto == null ? null : String(row.categoria_puesto),
    mensaje: row.mensaje == null ? null : String(row.mensaje),
    cv_url: String(row.cv_url || ''),
    cv_nombre: row.cv_nombre == null ? null : String(row.cv_nombre),
    cv_mime: row.cv_mime == null ? null : String(row.cv_mime),
    estado: String(row.estado || 'nuevo') as RrhhPostulacionEstado,
    metadata_ia: (row.metadata_ia as Record<string, unknown>) || {},
    score_ia: row.score_ia == null ? null : Number(row.score_ia),
    notas_rrhh: row.notas_rrhh == null ? null : String(row.notas_rrhh),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    revisado_por: row.revisado_por == null ? null : Number(row.revisado_por),
    revisado_at: row.revisado_at == null ? null : String(row.revisado_at)
  }
}

export async function rrhhPostulacionesListar(filters: {
  usuarioId: number
  busqueda?: string
  estado?: string
  puesto?: string
  limite?: number
}): Promise<{ success: boolean; data?: RrhhPostulacion[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_postulaciones_listar', {
      p_usuario_id: filters.usuarioId,
      p_busqueda: filters.busqueda || null,
      p_estado: filters.estado || null,
      p_puesto: filters.puesto || null,
      p_limite: filters.limite ?? 40
    })
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    return { success: true, data: rows.map((r) => mapRow(r as Record<string, unknown>)) }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al listar postulaciones') }
  }
}

export async function rrhhPostulacionesContar(filters: {
  usuarioId: number
  busqueda?: string
  estado?: string
  puesto?: string
}): Promise<{ success: boolean; data?: number; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_postulaciones_contar', {
      p_usuario_id: filters.usuarioId,
      p_busqueda: filters.busqueda || null,
      p_estado: filters.estado || null,
      p_puesto: filters.puesto || null
    })
    if (error) throw error
    return { success: true, data: Number(data) || 0 }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al contar postulaciones') }
  }
}

export async function rrhhPostulacionObtener(
  id: number
): Promise<{ success: boolean; data?: RrhhPostulacion; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.from('rrhh_postulaciones').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return { success: false, error: 'Postulación no encontrada' }
    return { success: true, data: mapRow(data as Record<string, unknown>) }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al cargar postulación') }
  }
}

export async function rrhhPostulacionActualizarEstado(
  usuarioId: number,
  id: number,
  estado: RrhhPostulacionEstado,
  notas?: string
): Promise<{ success: boolean; data?: RrhhPostulacion; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_postulacion_actualizar_estado', {
      p_usuario_id: usuarioId,
      p_id: id,
      p_estado: estado,
      p_notas_rrhh: notas || null
    })
    if (error) throw error
    const row = data as Record<string, unknown> | null
    if (!row) return { success: false, error: 'Sin respuesta' }
    return { success: true, data: mapRow(row) }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al guardar') }
  }
}
