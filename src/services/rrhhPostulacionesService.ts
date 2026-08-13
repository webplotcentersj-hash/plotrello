import { supabase } from './supabaseClient'
import { formatSupabaseStatementTimeoutError } from '../utils/supabaseErrors'
import { isTransientSupabaseError, withSupabaseRetry } from '../utils/supabaseRetry'
import type {
  RrhhPostulacion,
  RrhhPostulacionEstado,
  RrhhPostulacionesFunnel,
  UserRole
} from '../types/api'

export const RRHH_POSTULACIONES_PAGE_SIZE = 50

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return formatSupabaseStatementTimeoutError((e as { message: string }).message)
  }
  return fallback
}

/** RPC que devuelve `jsonb` (array) a veces llega como string o objeto único. */
function parseRpcJsonbRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
    } catch {
      return []
    }
  }
  return []
}

export function mapRrhhPostulacionRow(row: Record<string, unknown>): RrhhPostulacion {
  return {
    id: Number(row.id),
    legacy_id: row.legacy_id == null ? null : Number(row.legacy_id),
    nombre: String(row.nombre || ''),
    email: String(row.email || ''),
    telefono: row.telefono == null ? null : String(row.telefono),
    puesto: String(row.puesto || ''),
    categoria_puesto: row.categoria_puesto == null ? null : String(row.categoria_puesto),
    mensaje: row.mensaje == null ? null : String(row.mensaje),
    cv_url: row.cv_url == null ? null : String(row.cv_url),
    cv_nombre: row.cv_nombre == null ? null : String(row.cv_nombre),
    cv_mime: row.cv_mime == null ? null : String(row.cv_mime),
    estado: String(row.estado || 'nuevo') as RrhhPostulacionEstado,
    metadata_ia: (row.metadata_ia as Record<string, unknown>) || {},
    score_ia: row.score_ia == null ? null : Number(row.score_ia),
    notas_rrhh: row.notas_rrhh == null ? null : String(row.notas_rrhh),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    revisado_por: row.revisado_por == null ? null : Number(row.revisado_por),
    revisado_at: row.revisado_at == null ? null : String(row.revisado_at),
    entrevista_at: row.entrevista_at == null ? null : String(row.entrevista_at),
    oferta_at: row.oferta_at == null ? null : String(row.oferta_at),
    ingresado_at: row.ingresado_at == null ? null : String(row.ingresado_at),
    id_usuario: row.id_usuario == null ? null : Number(row.id_usuario)
  }
}

export type RrhhPostulacionesListFilters = {
  usuarioId: number
  busqueda?: string
  estado?: string
  puesto?: string
  tipo?: '' | 'formulario' | 'cv'
  limite?: number
  offset?: number
}

export async function rrhhPostulacionesListar(
  filters: RrhhPostulacionesListFilters
): Promise<{ success: boolean; data?: RrhhPostulacion[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  const sb = supabase
  try {
    const { data, error } = await withSupabaseRetry(
      async () => {
        const res = await sb.rpc('rrhh_postulaciones_listar', {
          p_usuario_id: filters.usuarioId,
          p_busqueda: filters.busqueda || null,
          p_estado: filters.estado || null,
          p_puesto: filters.puesto || null,
          p_limite: filters.limite ?? RRHH_POSTULACIONES_PAGE_SIZE,
          p_offset: filters.offset ?? 0,
          p_tipo: filters.tipo || null
        })
        if (res.error && isTransientSupabaseError(res.error)) throw res.error
        return res
      },
      { label: 'rrhh_postulaciones_listar', attempts: 3, baseDelayMs: 800 }
    )
    if (error) throw error
    const rows = parseRpcJsonbRows(data)
    return { success: true, data: rows.map((r) => mapRrhhPostulacionRow(r)) }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al listar postulaciones') }
  }
}

export async function rrhhPostulacionesContar(filters: {
  usuarioId: number
  busqueda?: string
  estado?: string
  puesto?: string
  tipo?: '' | 'formulario' | 'cv'
}): Promise<{ success: boolean; data?: number; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_postulaciones_contar', {
      p_usuario_id: filters.usuarioId,
      p_busqueda: filters.busqueda || null,
      p_estado: filters.estado || null,
      p_puesto: filters.puesto || null,
      p_tipo: filters.tipo || null
    })
    if (error) throw error
    return { success: true, data: Number(data) || 0 }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al contar postulaciones') }
  }
}

export async function rrhhPostulacionesFunnel(filters: {
  usuarioId: number
  tipo?: '' | 'formulario' | 'cv'
  fechaDesde?: string | null
  fechaHasta?: string | null
}): Promise<{ success: boolean; data?: RrhhPostulacionesFunnel; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_postulaciones_funnel', {
      p_usuario_id: filters.usuarioId,
      p_tipo: filters.tipo || null,
      p_fecha_desde: filters.fechaDesde || null,
      p_fecha_hasta: filters.fechaHasta || null
    })
    if (error) throw error
    const row = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown> | null
    if (!row) return { success: false, error: 'Sin datos de funnel' }
    return {
      success: true,
      data: {
        postulan: Number(row.postulan) || 0,
        en_revision: Number(row.en_revision) || 0,
        entrevista: Number(row.entrevista) || 0,
        oferta: Number(row.oferta) || 0,
        ingresado: Number(row.ingresado) || 0,
        descartado: Number(row.descartado) || 0
      }
    }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al cargar funnel') }
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
    return { success: true, data: mapRrhhPostulacionRow(data as Record<string, unknown>) }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al cargar postulación') }
  }
}

export async function rrhhPostulacionActualizarEstado(
  usuarioId: number,
  id: number,
  estado: RrhhPostulacionEstado,
  notas?: string,
  opts?: { entrevistaAt?: string | null; idUsuario?: number | null }
): Promise<{ success: boolean; data?: RrhhPostulacion; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  try {
    const { data, error } = await supabase.rpc('rrhh_postulacion_actualizar_estado', {
      p_usuario_id: usuarioId,
      p_id: id,
      p_estado: estado,
      p_notas_rrhh: notas || null,
      p_entrevista_at: opts?.entrevistaAt || null,
      p_id_usuario: opts?.idUsuario ?? null
    })
    if (error) throw error
    const row = data as Record<string, unknown> | null
    if (!row) return { success: false, error: 'Sin respuesta' }
    return { success: true, data: mapRrhhPostulacionRow(row) }
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al guardar') }
  }
}

/** Nombre de login a partir del email/nombre de la postulación. */
export function sugerirNombreUsuarioLogin(postulacion: RrhhPostulacion): string {
  const email = (postulacion.email || '').trim().toLowerCase()
  if (email.includes('@')) {
    const local = email.split('@')[0].replace(/[^a-z0-9._-]+/g, '').slice(0, 40)
    if (local) return local
  }
  return postulacion.nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 40) || `user${postulacion.id}`
}

function splitNombreApellido(nombreCompleto: string): { nombre: string; apellido: string } {
  const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { nombre: '', apellido: '' }
  if (parts.length === 1) return { nombre: parts[0], apellido: '' }
  return { nombre: parts[0], apellido: parts.slice(1).join(' ') }
}

function sectorDesdePuesto(puesto: string, categoria: string | null): string {
  if (categoria?.trim()) return categoria.trim()
  return puesto?.trim() || 'General'
}

/**
 * Alta automática: crea usuario + legajo y marca postulación como ingresado.
 */
export async function rrhhPostulacionIngresar(params: {
  gestorId: number
  postulacion: RrhhPostulacion
  loginNombre: string
  password: string
  rol: UserRole
  notas?: string
}): Promise<{ success: boolean; data?: RrhhPostulacion; error?: string }> {
  const { gestorId, postulacion, loginNombre, password, rol, notas } = params
  if (postulacion.id_usuario) {
    const linked = await rrhhPostulacionActualizarEstado(gestorId, postulacion.id, 'ingresado', notas, {
      idUsuario: postulacion.id_usuario
    })
    if (linked.success) {
      try {
        const { rrhhOnboardingIniciar } = await import('./rrhhExtendidoService')
        await rrhhOnboardingIniciar(postulacion.id_usuario)
      } catch {
        /* onboarding no crítico */
      }
    }
    return linked
  }

  try {
    const apiMod = await import('./api')
    const api = apiMod.default
    const created = await api.createUsuario({
      nombre: loginNombre.trim(),
      password,
      rol,
      actorId: gestorId
    })
    if (!created.success || !created.data?.id) {
      return { success: false, error: created.error || 'No se pudo crear el usuario' }
    }
    const idUsuario = created.data.id
    const { nombre, apellido } = splitNombreApellido(postulacion.nombre)
    const hoy = new Date().toISOString().slice(0, 10)
    const legajoRes = await api.crearActualizarLegajo(idUsuario, {
      id_usuario: idUsuario,
      nombre: nombre || postulacion.nombre,
      apellido: apellido || null,
      email: postulacion.email || null,
      telefono: postulacion.telefono || null,
      sector: sectorDesdePuesto(postulacion.puesto, postulacion.categoria_puesto),
      funciones: postulacion.puesto || null,
      fecha_ingreso: hoy,
      observaciones: `Alta desde postulación #${postulacion.id}`
    })

    if (!legajoRes.success) {
      // Usuario ya creado: igual vincular y avisar
      const linked = await rrhhPostulacionActualizarEstado(gestorId, postulacion.id, 'ingresado', notas, {
        idUsuario
      })
      if (linked.success && linked.data) {
        return {
          success: true,
          data: linked.data,
          error: `Usuario creado pero legajo falló: ${legajoRes.error}`
        }
      }
      return {
        success: false,
        error: `Usuario #${idUsuario} creado; legajo y vínculo fallaron: ${legajoRes.error}`
      }
    }

    const ingresado = await rrhhPostulacionActualizarEstado(
      gestorId,
      postulacion.id,
      'ingresado',
      notas,
      { idUsuario }
    )
    if (ingresado.success) {
      try {
        const { rrhhOnboardingIniciar } = await import('./rrhhExtendidoService')
        await rrhhOnboardingIniciar(idUsuario)
      } catch {
        /* onboarding no crítico */
      }
    }
    return ingresado
  } catch (e) {
    return { success: false, error: errMsg(e, 'Error al ingresar candidato') }
  }
}
