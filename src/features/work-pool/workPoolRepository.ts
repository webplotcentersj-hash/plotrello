import { supabase } from '../../services/supabaseClient'
import type {
  WorkPoolAdminDashboard,
  WorkPoolFreelancerResumen,
  WorkPoolJob,
  WorkPoolOrdenSugerida,
  WorkPoolPricingRule,
  WorkPoolProduct,
  WorkPoolProfile,
  WorkPoolResumenSector,
  WorkPoolSaldoOperario,
  WorkPoolSector
} from '../../types/workPool'
import { sectorsForProduct } from './workPoolConfig'
import {
  mapOrdenRow,
  mergeAndRankWorkPoolOpRows,
  parseWorkPoolOpQuery,
  WORK_POOL_OP_SEARCH_SELECT,
  type WorkPoolOpSearchRow
} from './workPoolOpSearch'
import {
  isOrdenEnTableroCola,
  supabaseHistorialSectorOrFilter,
  supabaseTableroColaOrFilter
} from './workPoolTablero'

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
  limit?: number
}): Promise<{ success: boolean; data?: WorkPoolJob[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  let query = supabase
    .from('work_pool_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200)

  if (opts.sector) query = query.eq('sector', opts.sector)
  if (opts.estado) query = query.eq('estado', opts.estado)
  if (opts.soloDisponibles) query = query.eq('estado', 'disponible')
  if (opts.idUsuario) query = query.eq('id_usuario_asignado', opts.idUsuario)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []).map((r) => mapJob(r as Record<string, unknown>)) }
}

function activasOrdenesFilter<T extends { or: (filters: string) => T }>(query: T): T {
  return query.or('eliminada.eq.false,eliminada.is.null')
}

function mapOrdenTableroSugerida(row: WorkPoolOpSearchRow): WorkPoolOrdenSugerida {
  return {
    id: row.id,
    numero_op: row.numero_op,
    cliente: row.cliente,
    descripcion: row.descripcion,
    estado: row.estado,
    sector: row.sector,
    en_tablero: true,
    en_tablero_diseno: true,
    brief_publico: row.brief_publico,
    objetivo_proyecto: row.objetivo_proyecto,
    brief_token: row.brief_token,
    id_pedido_cliente: row.id_pedido_cliente
  }
}

export async function listOrdenesTableroPorSector(
  sector: WorkPoolSector,
  limit = 30
): Promise<{ success: boolean; data?: WorkPoolOrdenSugerida[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  const { data, error } = await activasOrdenesFilter(
    supabase
      .from('ordenes_trabajo')
      .select(WORK_POOL_OP_SEARCH_SELECT)
      .or(supabaseTableroColaOrFilter(sector))
  )
    .order('fecha_creacion', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: (data ?? []).map((row) => mapOrdenTableroSugerida(mapOrdenRow(row as Record<string, unknown>)))
  }
}

/** @deprecated Usar listOrdenesTableroPorSector('diseno') */
export async function listOrdenesDisenoGraficoTablero(limit = 30) {
  return listOrdenesTableroPorSector('diseno', limit)
}

export type WorkPoolOperarioTrabajoItem = {
  id: string
  tipo: 'bolsa' | 'orden'
  titulo: string
  subtitulo: string
  fecha: string | null
  estado: string
  numero_op: string | null
  monto?: number | null
}

export type WorkPoolOperarioDetail = {
  foto_url: string | null
  legajo_sector: string | null
  saldo_pendiente: number
  acreditado: number
  trabajos: WorkPoolOperarioTrabajoItem[]
}

export async function loadOperarioWorkPoolDetail(input: {
  idUsuario: number
  nombre: string
  sector: WorkPoolSector
}): Promise<{ success: boolean; data?: WorkPoolOperarioDetail; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  const nombreNorm = input.nombre.trim().toLowerCase()
  const nombreLocal = nombreNorm.split('@')[0]

  const [jobsRes, ordenesRes, saldoRes, legajoRes] = await Promise.all([
    listWorkPoolJobs({ sector: input.sector, idUsuario: input.idUsuario, limit: 40 }),
    fetchOrdenesTableroHistorial(input.sector, 200),
    getSaldoOperario(input.idUsuario),
    supabase.rpc('obtener_legajo_empleado', { p_id_usuario: input.idUsuario })
  ])

  const trabajos: WorkPoolOperarioTrabajoItem[] = []

  for (const job of jobsRes.data ?? []) {
    trabajos.push({
      id: `job-${job.id}`,
      tipo: 'bolsa',
      titulo: job.titulo || job.numero_op || `Trabajo #${job.id}`,
      subtitulo: job.descripcion?.slice(0, 120) ?? '',
      fecha: job.aprobado_at ?? job.entregado_at ?? job.tomado_at ?? job.created_at,
      estado: job.estado,
      numero_op: job.numero_op,
      monto: job.monto_final ?? job.monto_presupuestado
    })
  }

  for (const orden of ordenesRes.data ?? []) {
    const opName = (orden.operario_asignado ?? '').toLowerCase()
    if (!opName.includes(nombreLocal) && !opName.includes(nombreNorm)) continue
    trabajos.push({
      id: `orden-${orden.numero_op ?? orden.fecha_creacion}`,
      tipo: 'orden',
      titulo: orden.numero_op
        ? `OP ${orden.numero_op}${orden.cliente ? ` · ${orden.cliente}` : ''}`
        : orden.descripcion?.slice(0, 80) || 'Trabajo en tablero',
      subtitulo: orden.descripcion?.slice(0, 100) ?? orden.estado ?? '',
      fecha: orden.fecha_entrega ?? orden.fecha_creacion,
      estado: orden.estado ?? 'tablero',
      numero_op: orden.numero_op ?? null
    })
  }

  trabajos.sort((a, b) => {
    const ta = a.fecha ? new Date(a.fecha).getTime() : 0
    const tb = b.fecha ? new Date(b.fecha).getTime() : 0
    return tb - ta
  })

  const legajoRow = Array.isArray(legajoRes.data) ? legajoRes.data[0] : legajoRes.data
  const legajo = legajoRow as { foto_url?: string | null; sector?: string | null } | null

  return {
    success: true,
    data: {
      foto_url: (legajo?.foto_url ?? '').trim() || null,
      legajo_sector: legajo?.sector ?? null,
      saldo_pendiente: saldoRes.data?.saldo_pendiente ?? 0,
      acreditado: saldoRes.data?.acreditado ?? 0,
      trabajos: trabajos.slice(0, 24)
    }
  }
}

export async function searchOrdenesWorkPool(
  query: string,
  limit = 15,
  opts?: { incluirTableroSector?: WorkPoolSector }
): Promise<{ success: boolean; data?: WorkPoolOrdenSugerida[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  const parsed = parseWorkPoolOpQuery(query)
  if (!parsed.canSearch) return { success: true, data: [] }

  const fetchIlike = async (column: string, value: string, take: number) => {
    const pattern = `%${value.replace(/[%_\\]/g, '\\$&')}%`
    const { data, error } = await activasOrdenesFilter(
      supabase!
        .from('ordenes_trabajo')
        .select(WORK_POOL_OP_SEARCH_SELECT)
        .ilike(column, pattern)
    )
      .order('fecha_creacion', { ascending: false })
      .limit(take)

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapOrdenRow(row as Record<string, unknown>))
  }

  try {
    const tasks: Promise<ReturnType<typeof mapOrdenRow>[]>[] = []

    if (parsed.idBd != null) {
      tasks.push(
        (async () => {
          const { data, error } = await activasOrdenesFilter(
            supabase.from('ordenes_trabajo').select(WORK_POOL_OP_SEARCH_SELECT).eq('id', parsed.idBd!)
          )
          if (error) throw new Error(error.message)
          return (data ?? []).map((row) => mapOrdenRow(row as Record<string, unknown>))
        })()
      )
    }

    if (parsed.opDigits) {
      tasks.push(fetchIlike('numero_op', parsed.opDigits, 30))
      tasks.push(fetchIlike('numero_ficha_original', parsed.opDigits, 12))
      if (parsed.opRaw && parsed.opRaw !== parsed.opDigits) {
        tasks.push(fetchIlike('numero_op', parsed.opRaw, 20))
      }
    }

    const searchTerms = new Set<string>()
    if (parsed.textBlob.length >= 2) searchTerms.add(parsed.textBlob)
    for (const token of parsed.tokens) searchTerms.add(token)

    for (const term of searchTerms) {
      if (parsed.isOpNumeric && term.replace(/\D/g, '') === parsed.opDigits) continue
      tasks.push(fetchIlike('cliente', term, 20))
      tasks.push(fetchIlike('descripcion', term, 15))
      tasks.push(fetchIlike('dni_cuit', term.replace(/\s/g, ''), 12))
      if (term.replace(/\D/g, '').length >= 4) {
        tasks.push(fetchIlike('telefono_cliente', term.replace(/\D/g, ''), 10))
      }
      if (term.includes('@')) {
        tasks.push(fetchIlike('email_cliente', term, 10))
      }
    }

    if (opts?.incluirTableroSector) {
      const tableroSector = opts.incluirTableroSector
      tasks.push(
        (async () => {
          const res = await listOrdenesTableroPorSector(tableroSector, 40)
          if (!res.success || !res.data) return []
          const q = parsed.textBlob
          if (!q || q.length < 2) {
            return res.data.map((o) => mapOrdenRow({ ...o, en_tablero: true, en_tablero_diseno: true }))
          }
          return res.data
            .filter((o) => {
              const blob = `${o.numero_op} ${o.cliente} ${o.descripcion ?? ''}`.toLowerCase()
              return blob.includes(q) || parsed.tokens.some((t) => blob.includes(t))
            })
            .map((o) => mapOrdenRow({ ...o, en_tablero: true, en_tablero_diseno: true }))
        })()
      )
    }

    const batches = await Promise.all(tasks)
    const tableroSector = opts?.incluirTableroSector
    const marked = batches.map((batch) =>
      batch.map((row) => {
        const enCola =
          row.en_tablero ??
          row.en_tablero_diseno ??
          (tableroSector ? isOrdenEnTableroCola(row.estado, tableroSector, row.sector) : false)
        return { ...row, en_tablero: enCola, en_tablero_diseno: enCola }
      })
    ) as WorkPoolOpSearchRow[][]
    const data = mergeAndRankWorkPoolOpRows(marked, parsed, limit)
    return { success: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al buscar OP'
    return { success: false, error: msg }
  }
}

export async function findWorkPoolJobForOp(
  numeroOp: string,
  sector: WorkPoolSector
): Promise<{ success: boolean; data?: WorkPoolJob | null; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const op = numeroOp.trim()
  if (!op) return { success: true, data: null }

  const { data, error } = await supabase
    .from('work_pool_jobs')
    .select('*')
    .eq('sector', sector)
    .eq('numero_op', op)
    .not('estado', 'in', '("cancelado")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: true, data: null }
  return { success: true, data: mapJob(data as Record<string, unknown>) }
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

export async function fetchOrdenesTableroHistorial(
  sector: WorkPoolSector,
  limit = 350
): Promise<{
  success: boolean
  data?: import('./workPoolOperarioRecommendations').OrdenDisenoHistorial[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .select('numero_op, cliente, descripcion, operario_asignado, fecha_creacion, fecha_entrega, etiquetas, sector, estado')
    .or('eliminada.eq.false,eliminada.is.null')
    .or(supabaseHistorialSectorOrFilter(sector))
    .order('fecha_creacion', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }
  return {
    success: true,
    data: (data ?? []).map((row) => ({
      numero_op: (row as { numero_op: string | null }).numero_op ?? null,
      cliente: (row as { cliente: string | null }).cliente ?? null,
      descripcion: (row as { descripcion: string | null }).descripcion ?? null,
      operario_asignado: (row as { operario_asignado: string | null }).operario_asignado ?? null,
      fecha_creacion: (row as { fecha_creacion: string | null }).fecha_creacion ?? null,
      fecha_entrega: (row as { fecha_entrega: string | null }).fecha_entrega ?? null,
      etiquetas: (row as { etiquetas: unknown }).etiquetas,
      estado: (row as { estado: string | null }).estado ?? null
    }))
  }
}

/** @deprecated Usar fetchOrdenesTableroHistorial('diseno') */
export async function fetchOrdenesDisenoHistorial(limit = 350) {
  return fetchOrdenesTableroHistorial('diseno', limit)
}

export async function recommendWorkPoolOperarios(input: {
  sector: WorkPoolSector
  candidatos: import('../../types/api').UsuarioRecord[]
  descripcion?: string
  codigoTarifa?: string | null
}): Promise<{
  success: boolean
  data?: import('./workPoolOperarioRecommendations').WorkPoolOperarioRecommendation[]
  error?: string
}> {
  const { buildWorkPoolOperarioRecommendations } = await import('./workPoolOperarioRecommendations')

  const [jobsRes, ordenesRes] = await Promise.all([
    listWorkPoolJobs({ sector: input.sector, limit: 450 }),
    fetchOrdenesTableroHistorial(input.sector)
  ])

  if (!jobsRes.success) return { success: false, error: jobsRes.error }

  const recommendations = buildWorkPoolOperarioRecommendations({
    candidatos: input.candidatos,
    jobs: jobsRes.data ?? [],
    ordenesDiseno: ordenesRes.data ?? [],
    descripcion: input.descripcion,
    codigoTarifa: input.codigoTarifa,
    sector: input.sector
  })

  return { success: true, data: recommendations }
}

export async function listWorkPoolProfiles(): Promise<{
  success: boolean
  data?: WorkPoolProfile[]
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase
    .from('work_pool_profiles')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as WorkPoolProfile[] }
}

async function fetchUsuarioNombres(
  ids: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (!supabase || ids.length === 0) return map

  const unique = [...new Set(ids)]
  const { data, error } = await supabase.rpc('obtener_usuarios_por_ids', {
    p_ids: unique
  })
  if (!error && Array.isArray(data)) {
    for (const row of data as Array<{ id: number; nombre?: string }>) {
      map.set(Number(row.id), String(row.nombre ?? `Usuario #${row.id}`))
    }
  }

  const missing = unique.filter((id) => !map.has(id))
  if (missing.length > 0) {
    const { data: rows } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .in('id', missing)
    for (const row of rows ?? []) {
      map.set(Number((row as { id: number }).id), String((row as { nombre: string }).nombre))
    }
  }

  return map
}

function isCurrentMonth(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export async function loadWorkPoolAdminDashboard(product?: WorkPoolProduct): Promise<{
  success: boolean
  data?: WorkPoolAdminDashboard
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  const productSectors = product ? sectorsForProduct(product) : null

  const [jobsRes, profilesRes, resumenRes] = await Promise.all([
    listWorkPoolJobs({}),
    listWorkPoolProfiles(),
    getResumenPlot()
  ])

  if (!jobsRes.success) return { success: false, error: jobsRes.error }
  let jobs = jobsRes.data ?? []
  let profiles = profilesRes.data ?? []
  let resumen = resumenRes.data ?? []

  if (productSectors) {
    jobs = jobs.filter((j) => productSectors.includes(j.sector))
    profiles = profiles.filter((p) => productSectors.includes(p.sector))
    resumen = resumen.filter((r) => productSectors.includes(r.sector as WorkPoolSector))
  }

  const userIds = new Set<number>()
  for (const j of jobs) {
    if (j.id_usuario_asignado) userIds.add(j.id_usuario_asignado)
  }
  for (const p of profiles) userIds.add(p.id_usuario)

  const nombres = await fetchUsuarioNombres([...userIds])

  const freelancerMap = new Map<number, WorkPoolFreelancerResumen>()

  const ensureFreelancer = (idUsuario: number): WorkPoolFreelancerResumen => {
    let f = freelancerMap.get(idUsuario)
    if (!f) {
      f = {
        id_usuario: idUsuario,
        nombre: nombres.get(idUsuario) ?? `Operario #${idUsuario}`,
        sectores: [],
        skills: [],
        zona_cobertura: null,
        perfil_aprobado: false,
        perfil_activo: false,
        trabajos_activos: 0,
        trabajos_aprobados: 0,
        pendientes_revision: 0,
        acreditado: 0,
        pagado: 0,
        saldo_pendiente: 0,
        ultimo_trabajo_at: null
      }
      freelancerMap.set(idUsuario, f)
    }
    return f
  }

  for (const p of profiles) {
    const f = ensureFreelancer(p.id_usuario)
    if (!f.sectores.includes(p.sector)) f.sectores.push(p.sector)
    f.skills = [...new Set([...f.skills, ...p.skills])]
    f.zona_cobertura = p.zona_cobertura ?? f.zona_cobertura
    f.perfil_aprobado = f.perfil_aprobado || p.aprobado
    f.perfil_activo = f.perfil_activo || p.activo
  }

  const activosEstados = new Set(['asignado', 'en_curso', 'cambios'])
  let pendientesRevision = 0
  let disponiblesBolsa = 0
  let aprobadosMes = 0

  for (const j of jobs) {
    if (j.estado === 'disponible') disponiblesBolsa += 1
    if (j.estado === 'entregado' || j.estado === 'en_revision') pendientesRevision += 1
    if (j.estado === 'aprobado' && isCurrentMonth(j.aprobado_at)) aprobadosMes += 1

    if (!j.id_usuario_asignado) continue
    const f = ensureFreelancer(j.id_usuario_asignado)
    if (!f.sectores.includes(j.sector)) f.sectores.push(j.sector)
    if (activosEstados.has(j.estado)) f.trabajos_activos += 1
    if (j.estado === 'aprobado') f.trabajos_aprobados += 1
    if (j.estado === 'entregado' || j.estado === 'en_revision') f.pendientes_revision += 1

    const refDate = j.aprobado_at ?? j.entregado_at ?? j.tomado_at ?? j.created_at
    if (refDate && (!f.ultimo_trabajo_at || refDate > f.ultimo_trabajo_at)) {
      f.ultimo_trabajo_at = refDate
    }
  }

  const saldoResults = await Promise.all(
    [...freelancerMap.keys()].map(async (id) => {
      const res = await getSaldoOperario(id)
      return { id, saldo: res.data }
    })
  )
  for (const { id, saldo } of saldoResults) {
    const f = freelancerMap.get(id)
    if (!f || !saldo) continue
    f.acreditado = saldo.acreditado
    f.pagado = saldo.pagado
    f.saldo_pendiente = saldo.saldo_pendiente
  }

  const freelancers = [...freelancerMap.values()].sort(
    (a, b) => b.saldo_pendiente - a.saldo_pendiente || b.trabajos_activos - a.trabajos_activos
  )

  const deudaTotal = resumen.reduce((s, r) => s + Number(r.deuda_operarios ?? 0), 0)
  const trabajosAbiertos = resumen.reduce((s, r) => s + Number(r.trabajos_abiertos ?? 0), 0)
  const operariosActivos = freelancers.filter((f) => f.trabajos_activos > 0 || f.saldo_pendiente > 0).length

  return {
    success: true,
    data: {
      kpis: {
        deuda_total: deudaTotal,
        trabajos_abiertos: trabajosAbiertos,
        pendientes_revision: pendientesRevision,
        operarios_activos: operariosActivos,
        disponibles_bolsa: disponiblesBolsa,
        aprobados_mes: aprobadosMes,
        acreditado_total: freelancers.reduce((s, f) => s + f.acreditado, 0),
        pagado_total: freelancers.reduce((s, f) => s + f.pagado, 0)
      },
      resumen_sectores: resumen,
      freelancers,
      pendientes_revision: jobs.filter((j) => j.estado === 'entregado' || j.estado === 'en_revision'),
      jobs_recientes: jobs.slice(0, 40)
    }
  }
}
