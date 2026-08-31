import { supabase } from '../../services/supabaseClient'
import type {
  WorkPoolAsociacionBusqueda,
  WorkPoolOperarioNota,
  WorkPoolOperarioNotaAdjunto,
  WorkPoolOperarioNotaTipo,
  WorkPoolOperarioNotasEstadisticas
} from '../../types/workPool'
import { argentinaDateKeyToIsoRange, isoToArgentinaDateKey } from '../../utils/dateUtils'
import { fallbackNombreSinEmail, nombreCompletoLegajo } from '../../utils/usuarioDisplayName'

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
  const raw = data as unknown
  const parsed =
    typeof raw === 'string'
      ? (JSON.parse(raw) as { id?: number })
      : ((raw ?? {}) as { id?: number })
  const id = Number(parsed?.id)
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
  const raw = data as unknown
  const rows = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (JSON.parse(raw) as unknown[])
      : []
  return { success: true, data: rows.map((r) => mapNota(r as Record<string, unknown>)) }
}

/** Todas las notas del usuario (bitácora + checklist + anotador), sin filtrar por tipo. */
export async function listarOperarioNotasTodas(opts: {
  id_usuario: number
  limitPerTipo?: number
}): Promise<{ success: boolean; data?: WorkPoolOperarioNota[]; error?: string }> {
  const limit = opts.limitPerTipo ?? 60
  const tipos: WorkPoolOperarioNotaTipo[] = ['bitacora', 'checklist', 'anotador']
  const results = await Promise.all(
    tipos.map((tipo) => listarOperarioNotas({ id_usuario: opts.id_usuario, tipo, limit }))
  )
  const failed = results.find((r) => !r.success)
  if (failed) return { success: false, error: failed.error || 'No se pudo cargar' }
  const byId = new Map<number, WorkPoolOperarioNota>()
  for (const r of results) {
    for (const n of r.data ?? []) byId.set(n.id, n)
  }
  return {
    success: true,
    data: [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
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

export const OPERARIO_ACTIVIDAD_EVENT = 'work-pool-operario-actividad'

export function emitOperarioActividad() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPERARIO_ACTIVIDAD_EVENT))
}

/** Registro silencioso en bitácora (tomar/entregar trabajo bolsa, tablero, etc.) para alimentar OPs hoy. */
export async function registrarActividadOperarioAutomatica(input: {
  id_usuario: number
  id_job?: number | null
  id_orden?: number | null
  numero_op?: string | null
  detalle: string
  titulo?: string
}): Promise<void> {
  if (!supabase) return
  try {
    let numero_op = input.numero_op?.trim() || null
    let tituloJob = input.titulo?.trim() || null
    let id_job = input.id_job ?? null
    const id_orden = input.id_orden ?? null

    if (input.id_job != null) {
      const { data: job } = await supabase
        .from('work_pool_jobs')
        .select('id, numero_op, titulo')
        .eq('id', input.id_job)
        .maybeSingle()
      if (job) {
        numero_op = numero_op || (job.numero_op as string | null) || null
        tituloJob = tituloJob || (job.titulo as string | null)?.trim() || null
        id_job = Number(job.id)
      }
    }

    if (!numero_op && id_orden == null && id_job == null) return

    const res = await crearOperarioNota({
      id_usuario: input.id_usuario,
      tipo: 'bitacora',
      detalle: input.detalle,
      titulo: tituloJob ?? (numero_op ? `OP ${numero_op}` : 'Trabajo tablero'),
      id_job,
      numero_op
    })
    if (res.success) emitOperarioActividad()
  } catch {
    /* no bloquear flujo principal */
  }
}

/** Tablero Plot Lab: movimiento / ficha abierta → bitácora automática. */
export async function registrarActividadTableroAutomatica(input: {
  id_usuario: number
  numero_op: string
  id_orden?: number | null
  detalle: string
  titulo?: string
}): Promise<void> {
  const op = input.numero_op.trim()
  if (!op) return
  await registrarActividadOperarioAutomatica({
    id_usuario: input.id_usuario,
    id_orden: input.id_orden ?? null,
    numero_op: op,
    detalle: input.detalle,
    titulo: input.titulo ?? `OP ${op}`
  })
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
  id_legajo?: number | null
}

export type WorkPoolNotaLegajo = WorkPoolOperarioNota & {
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
  fecha?: string | null
  limit?: number
}): Promise<{ success: boolean; data?: WorkPoolNotaSupervision[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_notas_supervision', {
    p_id_actor: opts.id_actor,
    p_limit: opts.limit ?? 120,
    p_id_operario: opts.id_operario ?? null,
    p_fecha: opts.fecha ?? null
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
        job_estado: (row.job_estado as string) ?? null,
        id_legajo: row.id_legajo != null ? Number(row.id_legajo) : null
      }
    })
  }
}

export async function listarNotasLegajoOperario(opts: {
  id_actor: number
  id_usuario: number
  fecha?: string | null
  limit?: number
}): Promise<{ success: boolean; data?: WorkPoolNotaLegajo[]; error?: string }> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('work_pool_operario_notas_legajo', {
    p_id_actor: opts.id_actor,
    p_id_usuario: opts.id_usuario,
    p_fecha: opts.fecha ?? null,
    p_limit: opts.limit ?? 80
  })
  if (error) return { success: false, error: error.message }
  const rows = Array.isArray(data) ? data : []
  return {
    success: true,
    data: rows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        ...mapNota(row),
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

/** Nota mínima para agrupar OPs / trabajos del día (FAB operario o supervisión admin). */
export type NotaParaOpsDelDia = {
  tipo: WorkPoolOperarioNotaTipo
  titulo: string | null
  detalle?: string | null
  id_job: number | null
  numero_op: string | null
  numero_venta: string | null
  numero_oportunidad: string | null
  hora_inicio: string | null
  hora_fin: string | null
  created_at: string
  job_titulo?: string | null
  id_usuario?: number
  usuario_nombre?: string | null
}

export type OpDelDia = {
  key: string
  label: string
  numero_op: string | null
  id_job: number | null
  entradas: number
  horario: string | null
  ultimaActividad: string
  estado?: string | null
  operarios?: Array<{ id: number; nombre: string }>
  actividades?: OpDelDiaActividad[]
}

export type OpDelDiaActividad = {
  timestamp: string
  texto: string
  fuente: 'tablero' | 'bitacora' | 'checklist' | 'anotador'
}

/** Extrae un número de OP de texto libre (ej. "OP 105642", "105642"). */
export function parseNumeroOpLibre(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = String(raw).trim().match(/(?:^|\b)(?:OP[\s#:-]*)?(\d{4,})\b/i)
  return m?.[1] ?? null
}

type JobParaOpsDelDia = {
  id: number
  titulo?: string | null
  numero_op?: string | null
  estado?: string | null
  tomado_at?: string | null
  updated_at?: string | null
  entregado_at?: string | null
  aprobado_at?: string | null
}

/**
 * Une OPs derivadas de notas con trabajos activos del operario (en curso / del día).
 */
export function mergeOpsDelDiaConJobs(
  opsFromNotas: OpDelDia[],
  jobs: JobParaOpsDelDia[],
  fechaKey: string
): OpDelDia[] {
  const map = new Map<string, OpDelDia>()
  for (const op of opsFromNotas) map.set(op.key, { ...op })

  const activos = new Set([
    'asignado',
    'en_curso',
    'cambios',
    'entregado',
    'en_revision',
    'aprobado'
  ])
  for (const j of jobs) {
    if (!activos.has(String(j.estado ?? ''))) continue
    const activityDates = [j.tomado_at, j.updated_at, j.entregado_at, j.aprobado_at].filter(
      Boolean
    ) as string[]
    const activityHoy = activityDates.some((d) => isoToArgentinaDateKey(d) === fechaKey)
    const enCurso = ['asignado', 'en_curso', 'cambios'].includes(String(j.estado ?? ''))
    if (!activityHoy && !enCurso) continue

    const numero_op = j.numero_op ?? null
    const key = numero_op ? `op-${numero_op}` : `job-${j.id}`
    const label = numero_op
      ? j.titulo?.trim()
        ? `OP ${numero_op} · ${j.titulo.trim()}`
        : `OP ${numero_op}`
      : j.titulo?.trim() || `Trabajo #${j.id}`
    const ultima =
      activityDates.sort((a, b) => b.localeCompare(a))[0] ||
      j.updated_at ||
      new Date().toISOString()

    const existing = map.get(key)
    if (existing) {
      map.set(key, {
        ...existing,
        id_job: existing.id_job ?? j.id,
        numero_op: existing.numero_op ?? numero_op,
        label: existing.label || label,
        estado: j.estado ?? existing.estado,
        ultimaActividad:
          ultima > existing.ultimaActividad ? ultima : existing.ultimaActividad
      })
    } else {
      map.set(key, {
        key,
        label,
        numero_op,
        id_job: j.id,
        entradas: 0,
        horario: null,
        ultimaActividad: ultima,
        estado: j.estado ?? null
      })
    }
  }

  return [...map.values()].sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad))
}

/** OP / ficha del tablero Plot Lab (kanban), no bolsa work-pool. */
export type TableroTaskParaOpsDelDia = {
  id: string
  opNumber: string
  title: string
  ownerId: string
  workingUser?: string
  status: string
  assignedSector?: string
  updatedAt: string
}

export type TableroActivityParaOpsDelDia = {
  taskId: string
  actorId: string
  timestamp: string
  note?: string
}

function upsertOpDelDia(map: Map<string, OpDelDia>, row: OpDelDia, entradasDelta = 0) {
  const existing = map.get(row.key)
  if (!existing) {
    map.set(row.key, { ...row, entradas: row.entradas || entradasDelta })
    return
  }
  map.set(row.key, {
    ...existing,
    label: existing.label || row.label,
    numero_op: existing.numero_op ?? row.numero_op,
    entradas: existing.entradas + entradasDelta,
    ultimaActividad:
      row.ultimaActividad > existing.ultimaActividad ? row.ultimaActividad : existing.ultimaActividad,
    estado: row.estado ?? existing.estado
  })
}

function mergeOperariosLists(
  a?: OpDelDia['operarios'],
  b?: OpDelDia['operarios']
): OpDelDia['operarios'] {
  const map = new Map<number, string>()
  for (const o of a ?? []) map.set(o.id, o.nombre)
  for (const o of b ?? []) map.set(o.id, o.nombre)
  if (map.size === 0) return undefined
  return [...map.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
}

/** Une varias listas de OPs del día (notas + tablero + bolsa). */
export function mergeOpsDelDiaList(...lists: OpDelDia[][]): OpDelDia[] {
  const map = new Map<string, OpDelDia>()
  for (const list of lists) {
    for (const op of list) {
      const existing = map.get(op.key)
      if (!existing) {
        map.set(op.key, { ...op })
        continue
      }
      map.set(op.key, {
        ...existing,
        label: existing.label || op.label,
        numero_op: existing.numero_op ?? op.numero_op,
        id_job: existing.id_job ?? op.id_job,
        entradas: existing.entradas + op.entradas,
        horario: existing.horario ?? op.horario,
        ultimaActividad:
          op.ultimaActividad > existing.ultimaActividad ? op.ultimaActividad : existing.ultimaActividad,
        estado: op.estado ?? existing.estado,
        operarios: mergeOperariosLists(existing.operarios, op.operarios)
      })
    }
  }
  return [...map.values()].sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad))
}

/**
 * OPs trabajadas hoy en el tablero: movimientos del operario + fichas asignadas / en curso.
 */
export function buildOpsDelDiaFromTablero(
  tasks: TableroTaskParaOpsDelDia[],
  activity: TableroActivityParaOpsDelDia[],
  opts: {
    fechaKey: string
    idUsuario: number
    isMyTask: (task: TableroTaskParaOpsDelDia) => boolean
    isWorkingOnTask?: (task: TableroTaskParaOpsDelDia) => boolean
  }
): OpDelDia[] {
  const map = new Map<string, OpDelDia>()
  const myId = String(opts.idUsuario)
  const taskByKey = new Map<string, TableroTaskParaOpsDelDia>()
  for (const t of tasks) {
    taskByKey.set(t.id, t)
    const ordenId = t.id.match(/^\d+$/) ? t.id : t.id.replace(/\D/g, '')
    if (ordenId) taskByKey.set(ordenId, t)
  }

  const resolveTask = (taskId: string) => taskByKey.get(taskId) ?? taskByKey.get(taskId.replace(/\D/g, ''))

  for (const ev of activity) {
    if (String(ev.actorId) !== myId) continue
    if (isoToArgentinaDateKey(ev.timestamp) !== opts.fechaKey) continue
    const task = resolveTask(ev.taskId)
    if (!task) continue
    const op = task.opNumber?.trim()
    if (!op) continue
    upsertOpDelDia(
      map,
      {
        key: `op-${op}`,
        label: task.title?.trim() ? `OP ${op} · ${task.title.trim()}` : `OP ${op}`,
        numero_op: op,
        id_job: null,
        entradas: 1,
        horario: null,
        ultimaActividad: ev.timestamp,
        estado: task.assignedSector ?? task.status ?? null
      },
      1
    )
  }

  for (const task of tasks) {
    if (!opts.isMyTask(task)) continue
    const op = task.opNumber?.trim()
    if (!op) continue
    const updatedHoy = isoToArgentinaDateKey(task.updatedAt) === opts.fechaKey
    const working = opts.isWorkingOnTask?.(task) ?? false
    if (!updatedHoy && !working) continue
    upsertOpDelDia(
      map,
      {
        key: `op-${op}`,
        label: task.title?.trim() ? `OP ${op} · ${task.title.trim()}` : `OP ${op}`,
        numero_op: op,
        id_job: null,
        entradas: working ? 1 : 0,
        horario: null,
        ultimaActividad: task.updatedAt,
        estado: task.assignedSector ?? task.status ?? null
      },
      working ? 1 : 0
    )
  }

  return [...map.values()].sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad))
}

function mergeHorariosNotas(notas: NotaParaOpsDelDia[]): string | null {
  const inicios = notas.map((n) => n.hora_inicio).filter(Boolean) as string[]
  const fines = notas.map((n) => n.hora_fin).filter(Boolean) as string[]
  if (inicios.length === 0 && fines.length === 0) return null
  const minInicio = inicios.length ? [...inicios].sort()[0] : null
  const maxFin = fines.length ? [...fines].sort().reverse()[0] : null
  return formatHorarioNota(minInicio, maxFin)
}

/**
 * Agrupa entradas del día por OP / trabajo / venta / oportunidad.
 * `fechaKey` en formato YYYY-MM-DD (Argentina). Si es null/omitido, usa todas las notas.
 */
export function buildOpsDelDia(
  notas: NotaParaOpsDelDia[],
  opts?: {
    fechaKey?: string | null
    jobLabelById?: (idJob: number) => string | null
  }
): OpDelDia[] {
  const fechaKey = opts?.fechaKey
  const dayNotas = fechaKey
    ? notas.filter((n) => isoToArgentinaDateKey(n.created_at) === fechaKey)
    : notas

  const relevant = dayNotas.filter(
    (n) =>
      n.numero_op ||
      n.id_job ||
      n.numero_venta ||
      n.numero_oportunidad ||
      Boolean(n.titulo?.trim())
  )

  type Acc = { row: OpDelDia; notas: NotaParaOpsDelDia[]; opsMap: Map<number, string> }
  const map = new Map<string, Acc>()

  for (const n of relevant) {
    let key: string
    let label: string
    const numero_op = n.numero_op
    const id_job = n.id_job

    if (n.numero_op) {
      key = `op-${n.numero_op}`
      label = n.job_titulo?.trim() ? `OP ${n.numero_op} · ${n.job_titulo.trim()}` : `OP ${n.numero_op}`
    } else if (n.id_job) {
      key = `job-${n.id_job}`
      const fromJobs = opts?.jobLabelById?.(n.id_job)
      label =
        fromJobs ||
        n.job_titulo?.trim() ||
        (n.titulo?.trim() ? n.titulo.trim() : `Trabajo #${n.id_job}`)
      if (numero_op) label = `OP ${numero_op} · ${label}`
    } else if (n.numero_venta) {
      key = `venta-${n.numero_venta}`
      label = `Venta ${n.numero_venta}`
    } else if (n.numero_oportunidad) {
      key = `opp-${n.numero_oportunidad}`
      label = `Opp ${n.numero_oportunidad}`
    } else {
      key = `titulo-${n.titulo?.trim()}`
      label = n.titulo?.trim() || 'Sin título'
    }

    const existing = map.get(key)
    if (existing) {
      existing.notas.push(n)
      existing.row.entradas += 1
      if (n.created_at > existing.row.ultimaActividad) {
        existing.row.ultimaActividad = n.created_at
      }
      existing.row.horario = mergeHorariosNotas(existing.notas)
      if (n.id_usuario != null) {
        existing.opsMap.set(n.id_usuario, n.usuario_nombre || `Usuario #${n.id_usuario}`)
      }
    } else {
      const opsMap = new Map<number, string>()
      if (n.id_usuario != null) {
        opsMap.set(n.id_usuario, n.usuario_nombre || `Usuario #${n.id_usuario}`)
      }
      map.set(key, {
        row: {
          key,
          label,
          numero_op,
          id_job,
          entradas: 1,
          horario: formatHorarioNota(n.hora_inicio, n.hora_fin),
          ultimaActividad: n.created_at
        },
        notas: [n],
        opsMap
      })
    }
  }

  return [...map.values()]
    .map(({ row, notas: grupo, opsMap }) => ({
      ...row,
      horario: mergeHorariosNotas(grupo) ?? row.horario,
      operarios: [...opsMap.entries()]
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }))
    .sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad))
}

export type HistorialTableroMovimiento = {
  id_orden: number
  id_usuario: number
  nombre_usuario: string | null
  timestamp: string
  estado_anterior: string | null
  estado_nuevo: string | null
  comentario: string | null
}

export type OrdenResumenParaOps = {
  id: number
  numero_op: string
  titulo: string | null
  estado: string | null
}

function esNumeroOpTablero(numeroOp: string | null | undefined): boolean {
  const op = numeroOp?.trim()
  if (!op) return false
  if (/^FICHA-/i.test(op)) return false
  return /^\d{4,}$/.test(op.replace(/\D/g, '')) || /\d{4,}/.test(op)
}

function textoActividadHistorial(mov: HistorialTableroMovimiento): string {
  const comentario = mov.comentario?.trim()
  if (comentario) {
    if (/abrió la ficha|plotai|movió a/i.test(comentario)) return comentario
  }
  const destino = mov.estado_nuevo?.trim()
  const origen = mov.estado_anterior?.trim()
  if (destino && origen && origen !== destino) {
    return `Movió la ficha de «${origen}» a «${destino}»`
  }
  if (destino) return `Movió la ficha a «${destino}»`
  return comentario || 'Actividad en el tablero'
}

/** Líneas de qué hizo el operario en cada OP (tablero + bitácora). */
export function buildActividadesPorOpDelDia(
  fechaKey: string,
  historial: HistorialTableroMovimiento[],
  ordenById: Map<number, OrdenResumenParaOps>,
  notas: NotaParaOpsDelDia[],
  opts?: { idUsuario?: number | null }
): Map<string, OpDelDiaActividad[]> {
  const map = new Map<string, OpDelDiaActividad[]>()
  const push = (key: string, row: OpDelDiaActividad) => {
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }

  for (const mov of historial) {
    if (opts?.idUsuario != null && mov.id_usuario !== opts.idUsuario) continue
    if (isoToArgentinaDateKey(mov.timestamp) !== fechaKey) continue
    const orden = ordenById.get(mov.id_orden)
    const op = numeroOpDesdeOrden(orden?.numero_op)
    if (!op) continue
    push(`op-${op}`, {
      timestamp: mov.timestamp,
      texto: textoActividadHistorial(mov),
      fuente: 'tablero'
    })
  }

  for (const n of notas) {
    if (opts?.idUsuario != null && n.id_usuario != null && n.id_usuario !== opts.idUsuario) continue
    if (isoToArgentinaDateKey(n.created_at) !== fechaKey) continue
    const op = n.numero_op?.trim()
    if (!op) continue
    const fuente =
      n.tipo === 'checklist' ? 'checklist' : n.tipo === 'anotador' ? 'anotador' : 'bitacora'
    const detalle = n.detalle?.trim()
    const titulo = n.titulo?.trim()
    let texto = detalle || titulo || 'Registro en bitácora'
    if (titulo && detalle && titulo !== detalle) texto = `${titulo} — ${detalle}`
    push(`op-${op}`, { timestamp: n.created_at, texto, fuente })
  }

  for (const [key, list] of map) {
    map.set(
      key,
      [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    )
  }
  return map
}

export function attachActividadesToOps(
  ops: OpDelDia[],
  actividades: Map<string, OpDelDiaActividad[]>
): OpDelDia[] {
  return ops.map((op) => ({
    ...op,
    actividades: actividades.get(op.key) ?? op.actividades
  }))
}

function numeroOpDesdeOrden(numeroOp: string | null | undefined): string | null {
  if (!esNumeroOpTablero(numeroOp)) return null
  const m = String(numeroOp).trim().match(/(\d{4,})/)
  return m?.[1] ?? null
}

/** OPs del día desde movimientos del kanban (supervisión, todos los operarios). */
export function buildOpsDelDiaFromHistorialTablero(
  movimientos: HistorialTableroMovimiento[],
  ordenById: Map<number, OrdenResumenParaOps>,
  fechaKey: string,
  opts?: { idUsuario?: number | null }
): OpDelDia[] {
  const map = new Map<string, OpDelDia>()
  const operariosByOp = new Map<string, Map<number, string>>()

  for (const mov of movimientos) {
    if (opts?.idUsuario != null && mov.id_usuario !== opts.idUsuario) continue
    if (isoToArgentinaDateKey(mov.timestamp) !== fechaKey) continue
    const orden = ordenById.get(mov.id_orden)
    if (!orden) continue
    const op = numeroOpDesdeOrden(orden.numero_op)
    if (!op) continue

    const key = `op-${op}`
    const titulo = orden.titulo?.trim()
    const label = titulo ? `OP ${op} · ${titulo}` : `OP ${op}`

    upsertOpDelDia(
      map,
      {
        key,
        label,
        numero_op: op,
        id_job: null,
        entradas: 1,
        horario: null,
        ultimaActividad: mov.timestamp,
        estado: mov.estado_nuevo ?? orden.estado ?? null
      },
      1
    )

    const opsMap = operariosByOp.get(key) ?? new Map<number, string>()
    const opId = mov.id_usuario
    const opNombre = esNombreOperarioValido(mov.nombre_usuario)
      ? mov.nombre_usuario!.trim()
      : `Operario #${opId}`
    opsMap.set(opId, opNombre)
    operariosByOp.set(key, opsMap)
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      operarios: [...(operariosByOp.get(row.key)?.entries() ?? [])]
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }))
    .sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad))
}

/** OPs del tablero agrupadas por operario (tarjetas de supervisión). */
export function buildOpsDelDiaPorOperarioFromHistorialTablero(
  movimientos: HistorialTableroMovimiento[],
  ordenById: Map<number, OrdenResumenParaOps>,
  fechaKey: string
): Map<number, OpDelDia[]> {
  const byUser = new Map<number, HistorialTableroMovimiento[]>()
  for (const mov of movimientos) {
    if (isoToArgentinaDateKey(mov.timestamp) !== fechaKey) continue
    const list = byUser.get(mov.id_usuario) ?? []
    list.push(mov)
    byUser.set(mov.id_usuario, list)
  }

  const result = new Map<number, OpDelDia[]>()
  for (const [userId, movs] of byUser) {
    result.set(userId, buildOpsDelDiaFromHistorialTablero(movs, ordenById, fechaKey, { idUsuario: userId }))
  }
  return result
}

async function fetchOrdenesResumenPorIds(ids: number[]): Promise<Map<number, OrdenResumenParaOps>> {
  const map = new Map<number, OrdenResumenParaOps>()
  if (!supabase || ids.length === 0) return map

  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  for (let i = 0; i < unique.length; i += 120) {
    const chunk = unique.slice(i, i + 120)
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('id, numero_op, descripcion, estado')
      .in('id', chunk)
    if (error || !data) continue
    for (const row of data as Array<Record<string, unknown>>) {
      const id = Number(row.id)
      if (!Number.isInteger(id)) continue
      map.set(id, {
        id,
        numero_op: String(row.numero_op ?? ''),
        titulo: (row.descripcion as string | null)?.trim() || null,
        estado: (row.estado as string | null) ?? null
      })
    }
  }
  return map
}

async function fetchNombresUsuarios(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (!supabase || ids.length === 0) return map

  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  for (let i = 0; i < unique.length; i += 120) {
    const chunk = unique.slice(i, i + 120)
    const { data: legajos } = await supabase
      .from('legajos_empleados')
      .select('id_usuario, nombre, apellido')
      .in('id_usuario', chunk)
    for (const row of legajos ?? []) {
      const id = Number((row as Record<string, unknown>).id_usuario)
      const nombre = nombreCompletoLegajo(row as { nombre?: string | null; apellido?: string | null })
      if (Number.isInteger(id) && nombre) map.set(id, nombre)
    }
  }

  const missing = unique.filter((id) => !map.has(id))
  if (missing.length > 0) {
    for (let i = 0; i < missing.length; i += 120) {
      const chunk = missing.slice(i, i + 120)
      const { data: users } = await supabase.from('usuarios').select('id, nombre').in('id', chunk)
      for (const row of users ?? []) {
        const id = Number((row as Record<string, unknown>).id)
        const nombre = String((row as Record<string, unknown>).nombre ?? '').trim()
        if (Number.isInteger(id) && nombre) {
          map.set(id, fallbackNombreSinEmail(nombre))
        }
      }
    }
  }

  return map
}

function esNombreOperarioValido(raw: string | null | undefined): boolean {
  const v = raw?.trim()
  if (!v) return false
  if (/^\d+$/.test(v)) return false
  if (/^(usuario|operario|admin)\s*#?\s*\d+$/i.test(v)) return false
  return true
}

/** Admin/sistema a veces graba el id real del operario en nombre_usuario (ej. "32"). */
export function idOperarioEfectivoHistorial(mov: HistorialTableroMovimiento): number {
  const raw = mov.nombre_usuario?.trim()
  if (raw && /^\d+$/.test(raw)) {
    const refId = Number(raw)
    if (Number.isInteger(refId) && refId > 0) return refId
  }
  return mov.id_usuario
}

function nombreOperarioDesdeMap(
  id: number,
  nombresById: Map<number, string>,
  fallback?: string | null
): string | null {
  const fromMap = nombresById.get(id)
  if (fromMap) return fromMap
  if (esNombreOperarioValido(fallback)) return fallback!.trim()
  return null
}

function normalizarMovimientosHistorialTablero(
  movimientos: HistorialTableroMovimiento[],
  nombresById: Map<number, string>
): HistorialTableroMovimiento[] {
  return movimientos.map((mov) => {
    const idEfectivo = idOperarioEfectivoHistorial(mov)
    const nombre =
      nombreOperarioDesdeMap(idEfectivo, nombresById, mov.nombre_usuario) ||
      nombreOperarioDesdeMap(mov.id_usuario, nombresById, mov.nombre_usuario)
    return {
      ...mov,
      id_usuario: idEfectivo,
      nombre_usuario: nombre
    }
  })
}

/** Movimientos del tablero + resumen de órdenes para armar OPs del día en supervisión. */
export async function cargarOpsTableroSupervisionDia(fechaKey: string): Promise<{
  success: boolean
  movimientos?: HistorialTableroMovimiento[]
  ordenById?: Map<number, OrdenResumenParaOps>
  nombresById?: Map<number, string>
  error?: string
}> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }

  const { desde, hasta } = argentinaDateKeyToIsoRange(fechaKey)
  const { data, error } = await supabase
    .from('historial_movimientos')
    .select('id_orden, id_usuario, nombre_usuario, timestamp, estado_anterior, estado_nuevo, comentario')
    .gte('timestamp', desde)
    .lte('timestamp', hasta)
    .order('timestamp', { ascending: false })
    .limit(4000)

  if (error) return { success: false, error: error.message }

  const movimientosRaw: HistorialTableroMovimiento[] = (data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        id_orden: Number(r.id_orden),
        id_usuario: Number(r.id_usuario),
        nombre_usuario: (r.nombre_usuario as string | null) ?? null,
        timestamp: String(r.timestamp ?? ''),
        estado_anterior: (r.estado_anterior as string | null) ?? null,
        estado_nuevo: (r.estado_nuevo as string | null) ?? null,
        comentario: (r.comentario as string | null) ?? null
      }
    })
    .filter((m) => Number.isInteger(m.id_orden) && m.id_orden > 0 && Number.isInteger(m.id_usuario))

  const userIds = new Set<number>()
  for (const m of movimientosRaw) {
    userIds.add(m.id_usuario)
    userIds.add(idOperarioEfectivoHistorial(m))
  }
  const nombresById = await fetchNombresUsuarios([...userIds])

  const movimientos = normalizarMovimientosHistorialTablero(movimientosRaw, nombresById)

  const ordenIds = [...new Set(movimientos.map((m) => m.id_orden))]
  const ordenById = await fetchOrdenesResumenPorIds(ordenIds)

  return { success: true, movimientos, ordenById, nombresById }
}
