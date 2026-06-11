import { supabase } from '../../services/supabaseClient'
import type {
  WorkPoolJob,
  WorkPoolPricingRule,
  WorkPoolResumenSector,
  WorkPoolSaldoOperario,
  WorkPoolSector
} from '../../types/workPool'

function mapJob(row: Record<string, unknown>): WorkPoolJob {
  return {
    id: Number(row.id),
    sector: row.sector as WorkPoolJob['sector'],
    id_orden: row.id_orden != null ? Number(row.id_orden) : null,
    numero_op: (row.numero_op as string) ?? null,
    titulo: String(row.titulo ?? ''),
    descripcion: (row.descripcion as string) ?? null,
    modo: row.modo as WorkPoolJob['modo'],
    estado: row.estado as WorkPoolJob['estado'],
    prioridad: String(row.prioridad ?? 'normal'),
    plazo: (row.plazo as string) ?? null,
    monto_presupuestado: Number(row.monto_presupuestado ?? 0),
    monto_final: row.monto_final != null ? Number(row.monto_final) : null,
    moneda: String(row.moneda ?? 'ARS'),
    id_usuario_asignado: row.id_usuario_asignado != null ? Number(row.id_usuario_asignado) : null,
    id_usuario_creador: row.id_usuario_creador != null ? Number(row.id_usuario_creador) : null,
    codigo_tarifa: (row.codigo_tarifa as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    notas_entrega: (row.notas_entrega as string) ?? null,
    motivo_rechazo: (row.motivo_rechazo as string) ?? null,
    tomado_at: (row.tomado_at as string) ?? null,
    entregado_at: (row.entregado_at as string) ?? null,
    aprobado_at: (row.aprobado_at as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    asignado_nombre: (row.asignado_nombre as string) ?? null
  }
}

export async function listWorkPoolJobs(opts: {
  sector?: WorkPoolSector
  estado?: string
  soloDisponibles?: boolean
  idUsuario?: number
}): Promise<{ success: boolean; data?: WorkPoolJob[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  let query = supabase
    .from('work_pool_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (opts.sector) query = query.eq('sector', opts.sector)
  if (opts.estado) query = query.eq('estado', opts.estado)
  if (opts.soloDisponibles) query = query.eq('estado', 'disponible')
  if (opts.idUsuario) query = query.eq('id_usuario_asignado', opts.idUsuario)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []).map((r) => mapJob(r as Record<string, unknown>)) }
}

export async function listPricingRules(
  sector: WorkPoolSector
): Promise<{ success: boolean; data?: WorkPoolPricingRule[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase
    .from('work_pool_pricing_rules')
    .select('*')
    .eq('sector', sector)
    .eq('activo', true)
    .order('nombre')
  if (error) return { success: false, error: error.message }
  return {
    success: true,
    data: (data ?? []) as WorkPoolPricingRule[]
  }
}

export async function crearWorkPoolJob(input: {
  sector: WorkPoolSector
  numero_op?: string
  titulo?: string
  descripcion?: string
  modo?: 'bolsa' | 'asignado'
  monto?: number
  codigo_tarifa?: string
  id_usuario_creador?: number
  id_usuario_asignado?: number
  plazo?: string
  prioridad?: string
}): Promise<{ success: boolean; data?: WorkPoolJob; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_crear_job', {
    p_sector: input.sector,
    p_numero_op: input.numero_op ?? null,
    p_titulo: input.titulo ?? null,
    p_descripcion: input.descripcion ?? null,
    p_modo: input.modo ?? 'bolsa',
    p_monto: input.monto ?? null,
    p_codigo_tarifa: input.codigo_tarifa ?? null,
    p_id_usuario_creador: input.id_usuario_creador ?? null,
    p_id_usuario_asignado: input.id_usuario_asignado ?? null,
    p_plazo: input.plazo ?? null,
    p_prioridad: input.prioridad ?? 'normal'
  })
  if (error) return { success: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { success: false, error: 'No se creó el trabajo' }
  const list = await listWorkPoolJobs({ sector: input.sector })
  const job = list.data?.find((j) => j.id === Number((row as { id: number }).id))
  return { success: true, data: job ?? mapJob(row as Record<string, unknown>) }
}

export async function tomarWorkPoolJob(
  idJob: number,
  idUsuario: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_tomar_job', {
    p_id_job: idJob,
    p_id_usuario: idUsuario
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function entregarWorkPoolJob(
  idJob: number,
  idUsuario: number,
  notas?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_entregar_job', {
    p_id_job: idJob,
    p_id_usuario: idUsuario,
    p_notas: notas ?? null
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function aprobarWorkPoolJob(
  idJob: number,
  idUsuarioAprobador: number,
  montoFinal?: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_aprobar_job', {
    p_id_job: idJob,
    p_id_usuario_aprobador: idUsuarioAprobador,
    p_monto_final: montoFinal ?? null
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function solicitarCambiosWorkPoolJob(
  idJob: number,
  idUsuario: number,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_solicitar_cambios_job', {
    p_id_job: idJob,
    p_id_usuario: idUsuario,
    p_motivo: motivo ?? null
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function getSaldoOperario(
  idUsuario: number
): Promise<{ success: boolean; data?: WorkPoolSaldoOperario; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_saldo_operario', {
    p_id_usuario: idUsuario
  })
  if (error) return { success: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { success: true, data: { acreditado: 0, pagado: 0, saldo_pendiente: 0 } }
  return {
    success: true,
    data: {
      acreditado: Number((row as WorkPoolSaldoOperario).acreditado ?? 0),
      pagado: Number((row as WorkPoolSaldoOperario).pagado ?? 0),
      saldo_pendiente: Number((row as WorkPoolSaldoOperario).saldo_pendiente ?? 0)
    }
  }
}

export async function getResumenPlot(): Promise<{
  success: boolean
  data?: WorkPoolResumenSector[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_resumen_plot')
  if (error) return { success: false, error: error.message }
  return {
    success: true,
    data: (data ?? []) as WorkPoolResumenSector[]
  }
}

export async function registrarPagoOperario(input: {
  id_usuario: number
  monto: number
  notas?: string
  registrado_por?: number
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('work_pool_registrar_pago', {
    p_id_usuario: input.id_usuario,
    p_monto: input.monto,
    p_notas: input.notas ?? null,
    p_registrado_por: input.registrado_por ?? null
  })
  return error ? { success: false, error: error.message } : { success: true }
}

export function isWorkPoolModuleAvailable(): boolean {
  return Boolean(supabase)
}
