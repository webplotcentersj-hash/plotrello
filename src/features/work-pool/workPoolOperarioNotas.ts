import { supabase } from '../../services/supabaseClient'
import type {
  WorkPoolAsociacionBusqueda,
  WorkPoolOperarioNota,
  WorkPoolOperarioNotaAdjunto,
  WorkPoolOperarioNotaTipo,
  WorkPoolOperarioNotasEstadisticas
} from '../../types/workPool'

function mapAdjuntos(raw: unknown): WorkPoolOperarioNotaAdjunto[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const r = item as Record<string, unknown>
      const url = String(r.url ?? '').trim()
      const nombre = String(r.nombre ?? '').trim()
      if (!url || !nombre) return null
      return {
        nombre,
        url,
        mime: (r.mime as string) ?? null,
        size: r.size != null ? Number(r.size) : null
      }
    })
    .filter(Boolean) as WorkPoolOperarioNotaAdjunto[]
}

function mapNota(row: Record<string, unknown>): WorkPoolOperarioNota {
  return {
    id: Number(row.id),
    id_usuario: Number(row.id_usuario),
    tipo: row.tipo as WorkPoolOperarioNotaTipo,
    titulo: (row.titulo as string) ?? null,
    detalle: String(row.detalle ?? ''),
    hecho: Boolean(row.hecho),
    id_job: row.id_job != null ? Number(row.id_job) : null,
    numero_op: (row.numero_op as string) ?? null,
    id_orden: row.id_orden != null ? Number(row.id_orden) : null,
    id_venta: row.id_venta != null ? Number(row.id_venta) : null,
    numero_venta: (row.numero_venta as string) ?? null,
    id_oportunidad: row.id_oportunidad != null ? Number(row.id_oportunidad) : null,
    numero_oportunidad: (row.numero_oportunidad as string) ?? null,
    adjuntos: mapAdjuntos(row.adjuntos),
    hora_inicio: (row.hora_inicio as string) ?? null,
    hora_fin: (row.hora_fin as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    usuario_nombre: (row.usuario_nombre as string) ?? null
  }
}

export async function crearOperarioNota(input: {
  id_usuario: number
  tipo: WorkPoolOperarioNotaTipo
  detalle: string
  titulo?: string
  id_job?: number | null
  numero_op?: string | null
  id_venta?: number | null
  numero_venta?: string | null
  id_oportunidad?: number | null
  numero_oportunidad?: string | null
  adjuntos?: WorkPoolOperarioNotaAdjunto[]
  hora_inicio?: string | null
  hora_fin?: string | null
}): Promise<{ success: boolean; id?: number; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_nota_crear', {
    p_id_usuario: input.id_usuario,
    p_tipo: input.tipo,
    p_detalle: input.detalle,
    p_titulo: input.titulo ?? null,
    p_id_job: input.id_job ?? null,
    p_numero_op: input.numero_op ?? null,
    p_id_venta: input.id_venta ?? null,
    p_numero_venta: input.numero_venta ?? null,
    p_id_oportunidad: input.id_oportunidad ?? null,
    p_numero_oportunidad: input.numero_oportunidad ?? null,
    p_adjuntos: input.adjuntos ?? [],
    p_hora_inicio: input.hora_inicio ?? null,
    p_hora_fin: input.hora_fin ?? null
  })
  if (error) return { success: false, error: error.message }
  const id = Number((data as { id?: number } | null)?.id)
  return { success: true, id: Number.isFinite(id) ? id : undefined }
}

export async function listarOperarioNotas(opts: {
  id_usuario: number
  tipo?: WorkPoolOperarioNotaTipo | null
  id_job?: number | null
  limit?: number
}): Promise<{ success: boolean; data?: WorkPoolOperarioNota[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_nota_listar', {
    p_id_usuario: opts.id_usuario,
    p_tipo: opts.tipo ?? null,
    p_id_job: opts.id_job ?? null,
    p_limit: opts.limit ?? 80
  })
  if (error) return { success: false, error: error.message }
  const rows = Array.isArray(data) ? data : []
  return { success: true, data: rows.map((r) => mapNota(r as Record<string, unknown>)) }
}

export async function listarOperarioNotasJob(
  idJob: number,
  limit = 60
): Promise<{ success: boolean; data?: WorkPoolOperarioNota[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_nota_listar_job', {
    p_id_job: idJob,
    p_limit: limit
  })
  if (error) return { success: false, error: error.message }
  const rows = Array.isArray(data) ? data : []
  return { success: true, data: rows.map((r) => mapNota(r as Record<string, unknown>)) }
}

export async function toggleOperarioChecklist(
  id: number,
  idUsuario: number,
  hecho?: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_operario_nota_toggle', {
    p_id: id,
    p_id_usuario: idUsuario,
    p_hecho: hecho ?? null
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function eliminarOperarioNota(
  id: number,
  idUsuario: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_operario_nota_eliminar', {
    p_id: id,
    p_id_usuario: idUsuario
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function buscarAsociacionesOperario(
  q: string,
  limit = 12
): Promise<{
  success: boolean
  data?: {
    ops: WorkPoolAsociacionBusqueda[]
    ventas: WorkPoolAsociacionBusqueda[]
    oportunidades: WorkPoolAsociacionBusqueda[]
  }
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_buscar_asociaciones', {
    p_q: q,
    p_limit: limit
  })
  if (error) return { success: false, error: error.message }
  const raw = (data ?? {}) as Record<string, unknown>
  const mapList = (arr: unknown): WorkPoolAsociacionBusqueda[] =>
    Array.isArray(arr)
      ? arr.map((item) => {
          const r = item as Record<string, unknown>
          return {
            kind: r.kind as WorkPoolAsociacionBusqueda['kind'],
            id: Number(r.id),
            label: String(r.label ?? ''),
            sublabel: (r.sublabel as string) ?? null,
            numero_op: (r.numero_op as string) ?? null,
            id_orden: r.id_orden != null ? Number(r.id_orden) : undefined,
            id_venta: r.id_venta != null ? Number(r.id_venta) : undefined,
            numero_venta: (r.numero_venta as string) ?? null,
            id_oportunidad: r.id_oportunidad != null ? Number(r.id_oportunidad) : undefined,
            numero_oportunidad: (r.numero_oportunidad as string) ?? null
          }
        })
      : []
  return {
    success: true,
    data: {
      ops: mapList(raw.ops),
      ventas: mapList(raw.ventas),
      oportunidades: mapList(raw.oportunidades)
    }
  }
}

export type WorkPoolNotaSupervision = WorkPoolOperarioNota & {
  usuario_rol?: string | null
  job_titulo?: string | null
  job_estado?: string | null
}

/** Admin / gerencia / Alejandro Chávez (id 6). */
export function canVerActividadesOperarios(usuario: {
  id?: number
  rol?: string
  nombre?: string
} | null): boolean {
  if (!usuario?.id) return false
  const rol = String(usuario.rol ?? '').toLowerCase()
  if (['administracion', 'administrador', 'admin', 'gerencia'].includes(rol)) return true
  if (usuario.id === 6) return true
  const nom = String(usuario.nombre ?? '').toLowerCase()
  if (nom.startsWith('achavez@')) return true
  return false
}

export async function listarNotasSupervisionOperarios(opts: {
  id_actor: number
  id_operario?: number | null
  limit?: number
}): Promise<{ success: boolean; data?: WorkPoolNotaSupervision[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_notas_supervision', {
    p_id_actor: opts.id_actor,
    p_limit: opts.limit ?? 120,
    p_id_operario: opts.id_operario ?? null
  })
  if (error) return { success: false, error: error.message }
  const rows = Array.isArray(data) ? data : []
  return {
    success: true,
    data: rows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        ...mapNota(row),
        usuario_rol: (row.usuario_rol as string) ?? null,
        job_titulo: (row.job_titulo as string) ?? null,
        job_estado: (row.job_estado as string) ?? null
      }
    })
  }
}

export async function obtenerEstadisticasOperarioNotas(opts: {
  id_actor: number
  dias?: number
}): Promise<{ success: boolean; data?: WorkPoolOperarioNotasEstadisticas; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_notas_estadisticas', {
    p_id_actor: opts.id_actor,
    p_dias: opts.dias ?? 30
  })
  if (error) return { success: false, error: error.message }
  const raw = (data ?? {}) as Record<string, unknown>
  const totales = (raw.totales ?? {}) as Record<string, unknown>
  const porOperario = Array.isArray(raw.por_operario) ? raw.por_operario : []
  const porDia = Array.isArray(raw.por_dia) ? raw.por_dia : []
  return {
    success: true,
    data: {
      periodo_dias: Number(raw.periodo_dias ?? opts.dias ?? 30),
      totales: {
        total: Number(totales.total ?? 0),
        bitacora: Number(totales.bitacora ?? 0),
        checklist: Number(totales.checklist ?? 0),
        anotador: Number(totales.anotador ?? 0),
        checklist_hechos: Number(totales.checklist_hechos ?? 0),
        con_adjuntos: Number(totales.con_adjuntos ?? 0),
        con_horario: Number(totales.con_horario ?? 0),
        minutos_registrados: Number(totales.minutos_registrados ?? 0)
      },
      por_operario: porOperario.map((item) => {
        const r = item as Record<string, unknown>
        return {
          id_usuario: Number(r.id_usuario),
          nombre: String(r.nombre ?? ''),
          total: Number(r.total ?? 0),
          bitacora: Number(r.bitacora ?? 0),
          checklist: Number(r.checklist ?? 0),
          anotador: Number(r.anotador ?? 0),
          checklist_hechos: Number(r.checklist_hechos ?? 0),
          minutos_registrados: Number(r.minutos_registrados ?? 0)
        }
      }),
      por_dia: porDia.map((item) => {
        const r = item as Record<string, unknown>
        return {
          fecha: String(r.fecha ?? ''),
          total: Number(r.total ?? 0),
          bitacora: Number(r.bitacora ?? 0),
          checklist: Number(r.checklist ?? 0)
        }
      })
    }
  }
}

export function formatHorarioNota(horaInicio: string | null, horaFin: string | null): string | null {
  if (!horaInicio) return null
  const fmt = (t: string) => {
    const parts = t.split(':')
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`
    return t
  }
  if (horaFin) return `${fmt(horaInicio)} – ${fmt(horaFin)}`
  return fmt(horaInicio)
}

export function formatMinutos(minutos: number): string {
  if (minutos <= 0) return '0 min'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h <= 0) return `${m} min`
  if (m <= 0) return `${h} h`
  return `${h} h ${m} min`
}
