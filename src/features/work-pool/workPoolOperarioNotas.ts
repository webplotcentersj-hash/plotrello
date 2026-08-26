import { supabase } from '../../services/supabaseClient'
import type {
  WorkPoolAsociacionBusqueda,
  WorkPoolOperarioNota,
  WorkPoolOperarioNotaTipo
} from '../../types/workPool'

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
    p_numero_oportunidad: input.numero_oportunidad ?? null
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
