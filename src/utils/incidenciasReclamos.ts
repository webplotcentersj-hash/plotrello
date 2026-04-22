import type { ColumnConfig } from '../types/board'
import type { HistorialMovimiento, OrdenTrabajo } from '../types/api'

export type IncidenciaReclamoRow = {
  ordenId: number
  orden: OrdenTrabajo | undefined
  /** Caso abierto en tablero / sin cierre registrado */
  activo: boolean
  motivoDisplay: string
  /** Etapa kanban cuando se marcó el reclamo (auditoría) */
  estadoAlMarcar: string | null
  sectorLabel: string
  usuarioMarca: string | null
  tsPrimeraApertura: string | null
  tsUltimaApertura: string | null
  tsUltimoCierre: string | null
  /** Cantidad de veces que se abrió reclamo en esta OP */
  ciclosReclamo: number
  /** Eventos de esta OP (orden cronológico) */
  eventosRelacionados: HistorialMovimiento[]
}

export type IncidenciasEstadisticas = {
  /** Solo Diseño / Imprenta / Talleres / Instalaciones / Metalúrgica / Mostrador (sector); excluye Finalizado en Taller y Almacén de Entrega */
  ambitoProductivo: true
  ordenesUnicasConReclamo: number
  casosActivos: number
  casosCerrados: number
  /** Cada fila = una apertura de reclamo en ámbito */
  totalAperturasHistoricas: number
  opsConReclamoMultiple: number
  /** Reclamos donde el sector negocio menciona Mostrador */
  aperturasMostradorSector: number
  porEstadoKanban: Array<{ estado: string; count: number; porcentaje: number }>
  porSector: Array<{ sector: string; count: number; porcentaje: number }>
  porUsuarioMarca: Array<{ usuario: string; count: number; porcentaje: number }>
  /** Ranking por nombre_creador en OP */
  porCreadorOp: Array<{ creador: string; count: number; porcentaje: number }>
  porMesApertura: Array<{ mes: string; count: number }>
  distribucionCiclos: Array<{ ciclos: string; ops: number }>
  tiempoResolucion: {
    mediaDias: number | null
    medianaDias: number | null
    muestras: number
  }
  /** Suma de días en reclamo (cierres + casos abiertos hasta “hoy”) solo ámbito */
  diasPerdidosAcumulados: number
  paresCierre: Array<{ ordenId: number; dias: number }>
  /** Suma reclamo_costo_monto en OP del conjunto filtrado */
  totalCostoExtraMonto: number
  porEtiquetas: Array<{ etiqueta: string; count: number; porcentaje: number }>
  /** Mes calendario (YYYY-MM) dentro del período de métricas */
  detalleMensual: Array<{ mes: string; aperturas: number; costoExtra: number; diasPerdidos: number }>
}

/** Opciones para métricas (período + sólo activos). Usar desdeMs=0 y hastaMs=Date.now() para todo el histórico. */
export type IncidenciasMetricasOpciones = {
  desdeMs: number
  hastaMs: number
  soloActivos: boolean
}

export function parseEtiquetasOrden(o: OrdenTrabajo | undefined): string[] {
  const raw = o?.reclamo_etiquetas as unknown
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
  if (typeof raw === 'string') return raw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
  return []
}

export function costoExtraOrdenMonto(o: OrdenTrabajo | undefined): number {
  const n = o?.reclamo_costo_monto
  if (n == null) return 0
  const x = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(x) && x >= 0 ? x : 0
}

/** Etapas del tablero incluidas en analítica (no Finalizado / Almacén) */
export const INCIDENCIAS_ETAPAS_PRODUCTIVAS: readonly string[] = [
  'Diseño Gráfico',
  'Diseño en Proceso',
  'Imprenta (Área de Impresión)',
  'Taller de Imprenta',
  'Taller Gráfico',
  'Instalaciones',
  'Metalúrgica'
]

function normLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

const LABEL_EXCLUIDOS_NORMALIZADOS = new Set([
  normLabel('Finalizado en Taller'),
  normLabel('Almacén de Entrega')
])

const ALLOW_ETAPA = new Set(INCIDENCIAS_ETAPAS_PRODUCTIVAS.map((x) => normLabel(x)))

function sectorEsMostrador(sectorText: string | null | undefined): boolean {
  if (!sectorText?.trim()) return false
  return /\bmostrador\b/i.test(sectorText)
}

/** Apertura de reclamo contabilizada en KPIs / mapas (excluye fin. taller y almacén) */
export function aperturaEnAmbitoProductivo(
  ev: HistorialMovimiento,
  ordenById: Map<number, OrdenTrabajo>
): boolean {
  const labRaw = (ev.estado_anterior ?? ev.estado_nuevo ?? '').trim()
  const lab = normLabel(labRaw)
  if (LABEL_EXCLUIDOS_NORMALIZADOS.has(lab)) return false

  const orden = ordenById.get(ev.id_orden)
  const sec = sectorDesdeOrden(orden)
  if (sectorEsMostrador(sec)) return true

  if (!labRaw) return false
  return ALLOW_ETAPA.has(lab)
}

/** Fila de incidencia pertenece al ámbito de análisis (lista / métricas) */
export function esIncidenciaEnAmbitoProductivo(row: IncidenciaReclamoRow): boolean {
  const lab = normLabel(row.estadoAlMarcar ?? '')
  if (LABEL_EXCLUIDOS_NORMALIZADOS.has(lab)) return false
  if (sectorEsMostrador(row.sectorLabel)) return true
  if (!row.estadoAlMarcar?.trim()) return sectorEsMostrador(row.sectorLabel)
  return ALLOW_ETAPA.has(lab)
}

export const INCIDENCIAS_MAPA_COLUMN_IDS = new Set([
  'diseno-grafico',
  'diseno-proceso',
  'imprenta',
  'taller-imprenta',
  'taller-grafico',
  'instalaciones',
  'metalurgica'
])

function classifyReclamoEvent(ev: HistorialMovimiento): 'apertura' | 'cierre' | 'ignore' {
  const tipo = (ev.accion_tipo ?? '').trim().toLowerCase()
  if (tipo === 'reclamo') return 'apertura'
  if (tipo === 'reclamo_resuelto') return 'cierre'

  const c = (ev.comentario ?? '').trim()
  if (!c.includes('[RECLAMO]')) return 'ignore'
  if (/Marca de reclamo quitada/i.test(c) || /quitada por/i.test(c)) return 'cierre'
  if (/debe rehacerse/i.test(c) || /Motivo:/i.test(c)) return 'apertura'

  return 'ignore'
}

export function parseMotivoDesdeComentarioReclamo(comentario: string | null | undefined): string {
  if (!comentario) return ''
  const c = comentario.trim()
  const m = c.match(/Motivo:\s*([\s\S]+?)$/im)
  if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ')
  return ''
}

function sectorDesdeOrden(o: OrdenTrabajo | undefined): string {
  if (!o) return 'Sin datos'
  if (Array.isArray(o.sectores) && o.sectores.length > 0) return o.sectores.filter(Boolean).join(', ')
  return (o.sector ?? '').trim() || 'Sin sector'
}

/** Color de columna del tablero por etiqueta de estado */
export function estadoToBoardAccent(estadoLabel: string | null | undefined, columns: ColumnConfig[]): string {
  const e = (estadoLabel ?? '').trim().toLowerCase()
  if (!e) return '#64748b'
  const col = columns.find((c) => c.label.trim().toLowerCase() === e)
  return col?.accent ?? '#64748b'
}

export function buildIncidenciasDesdeHistorial(
  todasLasOrdenes: OrdenTrabajo[],
  eventos: HistorialMovimiento[],
  _columns: ColumnConfig[]
): {
  rows: IncidenciaReclamoRow[]
} {
  const ordenById = new Map<number, OrdenTrabajo>()
  for (const o of todasLasOrdenes) ordenById.set(o.id, o)

  const byOrden = new Map<number, HistorialMovimiento[]>()
  for (const ev of eventos) {
    const oid = ev.id_orden
    if (!Number.isFinite(oid)) continue
    const arr = byOrden.get(oid)
    if (arr) arr.push(ev)
    else byOrden.set(oid, [ev])
  }

  for (const arr of byOrden.values()) {
    arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  /** OPs marcadas activas sin ningún evento parseable (legacy) */
  const idsExtra = new Set<number>()
  for (const o of todasLasOrdenes) {
    if (o.en_reclamo === true && !byOrden.has(o.id)) idsExtra.add(o.id)
  }

  const ordenIdsConEvento = [...byOrden.keys()]
  const todasIdsAFusionar = new Set<number>([...ordenIdsConEvento, ...idsExtra])

  const rows: IncidenciaReclamoRow[] = []

  for (const ordenId of todasIdsAFusionar) {
    const orden = ordenById.get(ordenId)
    const lista = byOrden.get(ordenId) ?? []

    if (lista.length === 0 && orden?.en_reclamo === true) {
      rows.push({
        ordenId,
        orden,
        activo: true,
        motivoDisplay: (orden.reclamo_motivo ?? '').trim(),
        estadoAlMarcar: orden.estado ?? null,
        sectorLabel: sectorDesdeOrden(orden),
        usuarioMarca: null,
        tsPrimeraApertura: orden.fecha_creacion ?? null,
        tsUltimaApertura: orden.fecha_creacion ?? null,
        tsUltimoCierre: null,
        ciclosReclamo: 1,
        eventosRelacionados: []
      })
      continue
    }

    if (lista.length === 0) continue

    const clasificados = lista.map((ev) => ({
      ev,
      k: classifyReclamoEvent(ev)
    }))

    let balance = 0
    let tsPrimeraApertura: string | null = null
    let tsUltimaApertura: string | null = null
    let tsUltimoCierre: string | null = null
    let usuarioUltimaMarca: string | null = null
    let estadoUltimaMarca: string | null = null
    let ciclosReclamo = 0

    const aperturasParaStats: HistorialMovimiento[] = []
    const cierresParaStats: HistorialMovimiento[] = []

    for (const { ev, k } of clasificados) {
      if (k === 'ignore') continue
      if (k === 'apertura') {
        balance += 1
        ciclosReclamo += 1
        tsUltimaApertura = ev.timestamp
        if (!tsPrimeraApertura) tsPrimeraApertura = ev.timestamp
        usuarioUltimaMarca = (ev.nombre_usuario ?? '').trim() || usuarioUltimaMarca
        const est = (ev.estado_anterior ?? ev.estado_nuevo ?? '').trim()
        if (est) estadoUltimaMarca = est
        aperturasParaStats.push(ev)
      } else if (k === 'cierre') {
        balance -= 1
        tsUltimoCierre = ev.timestamp
        cierresParaStats.push(ev)
      }
    }

    const activoBd = orden?.en_reclamo === true
    const activo = activoBd || balance > 0

    let motivoDisplay = ''
    if (activoBd && (orden?.reclamo_motivo ?? '').trim()) {
      motivoDisplay = (orden!.reclamo_motivo ?? '').trim()
    } else {
      const ultimaAperturaEv = [...aperturasParaStats].pop()
      motivoDisplay =
        parseMotivoDesdeComentarioReclamo(ultimaAperturaEv?.comentario) ||
        (orden?.reclamo_motivo ?? '').trim() ||
        parseMotivoDesdeComentarioReclamo(
          lista.find((x) => classifyReclamoEvent(x) === 'apertura')?.comentario
        ) ||
        ''
    }

    const estadoAlMarcar =
      estadoUltimaMarca ||
      (() => {
        const firstA = lista.find((x) => classifyReclamoEvent(x) === 'apertura')
        return (firstA?.estado_anterior ?? firstA?.estado_nuevo ?? '').trim() || null
      })()

    rows.push({
      ordenId,
      orden,
      activo,
      motivoDisplay,
      estadoAlMarcar,
      sectorLabel: sectorDesdeOrden(orden),
      usuarioMarca: usuarioUltimaMarca,
      tsPrimeraApertura,
      tsUltimaApertura,
      tsUltimoCierre,
      ciclosReclamo,
      eventosRelacionados: lista
    })
  }

  rows.sort((a, b) => {
    const ta = new Date(a.tsUltimaApertura ?? a.orden?.fecha_creacion ?? 0).getTime()
    const tb = new Date(b.tsUltimaApertura ?? b.orden?.fecha_creacion ?? 0).getTime()
    return tb - ta
  })

  return { rows }
}

function mesKeysEntre(desdeMs: number, hastaMs: number): string[] {
  const out: string[] = []
  const d = new Date(desdeMs)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  const fin = new Date(hastaMs)
  while (d.getTime() <= fin.getTime()) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

function boundsMes(mesKey: string): [number, number] {
  const [ys, ms] = mesKey.split('-').map(Number)
  const start = new Date(ys, ms - 1, 1).getTime()
  const end = new Date(ys, ms, 0, 23, 59, 59, 999).getTime()
  return [start, end]
}

function diasUnixOverlap(t0: number, t1: number, winA: number, winB: number): number {
  const a = Math.max(t0, winA)
  const b = Math.min(t1, winB)
  if (!Number.isFinite(t0) || b <= a) return 0
  return (b - a) / 86400000
}

/** Primer momento con apertura ámbito (para acotar “todo el histórico” en tablas mensuales) */
function primeraAperturaAmbitoMs(eventos: HistorialMovimiento[], ordenById: Map<number, OrdenTrabajo>): number {
  let min = Number.POSITIVE_INFINITY
  for (const ev of eventos) {
    if (classifyReclamoEvent(ev) !== 'apertura') continue
    if (!aperturaEnAmbitoProductivo(ev, ordenById)) continue
    const t = new Date(ev.timestamp).getTime()
    if (Number.isFinite(t) && t < min) min = t
  }
  return min === Number.POSITIVE_INFINITY ? Date.now() : min
}


function pickLabelEstadoParaStats(ev: HistorialMovimiento): string {
  const raw = (ev.estado_anterior ?? ev.estado_nuevo ?? '').trim()
  return raw || 'Sin etapa registrada'
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Orden visual: columnas productivas del tablero + Mostrador + resto */
function orderPorEstadoAmbitoProductivo(
  items: Array<{ estado: string; count: number; porcentaje: number }>,
  columns: ColumnConfig[]
): Array<{ estado: string; count: number; porcentaje: number }> {
  const productiveCols = columns.filter((c) => INCIDENCIAS_MAPA_COLUMN_IDS.has(c.id))
  const order = new Map<string, number>()
  let idx = 0
  for (const c of productiveCols) order.set(normLabel(c.label), idx++)
  order.set(normLabel('Mostrador'), idx++)
  return [...items].sort((a, b) => {
    const ia = order.get(normLabel(a.estado))
    const ib = order.get(normLabel(b.estado))
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined) return -1
    if (ib !== undefined) return 1
    return b.count - a.count
  })
}

function etiquetaEtapaAperturaProductiva(ev: HistorialMovimiento, ordenById: Map<number, OrdenTrabajo>): string {
  const orden = ordenById.get(ev.id_orden)
  if (sectorEsMostrador(sectorDesdeOrden(orden))) return 'Mostrador'
  return pickLabelEstadoParaStats(ev)
}

export function computeIncidenciasEstadisticas(
  rows: IncidenciaReclamoRow[],
  todosEventos: HistorialMovimiento[],
  columns: ColumnConfig[],
  ordenById: Map<number, OrdenTrabajo>,
  opts: IncidenciasMetricasOpciones
): IncidenciasEstadisticas {
  const { desdeMs: d0, hastaMs: h0, soloActivos } = opts
  const desdeMs = d0 <= 0 ? primeraAperturaAmbitoMs(todosEventos, ordenById) : d0
  const hastaMs = h0

  const rowsAmbito = rows.filter(esIncidenciaEnAmbitoProductivo)

  const idsAperturaEnVentana = new Set<number>()
  for (const ev of todosEventos) {
    if (classifyReclamoEvent(ev) !== 'apertura') continue
    if (!aperturaEnAmbitoProductivo(ev, ordenById)) continue
    const ts = new Date(ev.timestamp).getTime()
    if (ts >= desdeMs && ts <= hastaMs) idsAperturaEnVentana.add(ev.id_orden)
  }

  let rowsStats = rowsAmbito.filter((r) => idsAperturaEnVentana.has(r.ordenId))
  if (soloActivos) rowsStats = rowsStats.filter((r) => r.activo)

  const casosActivos = rowsStats.filter((r) => r.activo).length
  const casosCerrados = rowsStats.filter((r) => !r.activo).length
  const ordenesUnicasConReclamo = rowsStats.length

  const aperturas: HistorialMovimiento[] = []
  let aperturasMostradorSector = 0
  for (const ev of todosEventos) {
    if (classifyReclamoEvent(ev) !== 'apertura') continue
    if (!aperturaEnAmbitoProductivo(ev, ordenById)) continue
    const ts = new Date(ev.timestamp).getTime()
    if (ts < desdeMs || ts > hastaMs) continue
    aperturas.push(ev)
    const orden = ordenById.get(ev.id_orden)
    if (sectorEsMostrador(sectorDesdeOrden(orden))) aperturasMostradorSector += 1
  }
  const totalAperturasHistoricas = aperturas.length

  const ciclosPorOrden = new Map<number, number>()
  for (const r of rowsStats) ciclosPorOrden.set(r.ordenId, r.ciclosReclamo)
  const opsConReclamoMultiple = [...ciclosPorOrden.values()].filter((n) => n > 1).length

  const countEstado: Record<string, number> = {}
  for (const ev of aperturas) {
    const lab = etiquetaEtapaAperturaProductiva(ev, ordenById)
    countEstado[lab] = (countEstado[lab] ?? 0) + 1
  }
  const sumEst = Object.values(countEstado).reduce((a, b) => a + b, 0) || 1
  const porEstadoKanban = orderPorEstadoAmbitoProductivo(
    Object.entries(countEstado).map(([estado, count]) => ({
      estado,
      count,
      porcentaje: Math.round((count / sumEst) * 1000) / 10
    })),
    columns
  )

  const countSector: Record<string, number> = {}
  for (const r of rowsStats) {
    const sec = r.sectorLabel || 'Sin datos'
    countSector[sec] = (countSector[sec] ?? 0) + 1
  }
  const sumSec = Object.values(countSector).reduce((a, b) => a + b, 0) || 1
  const porSector = Object.entries(countSector)
    .map(([sector, count]) => ({
      sector,
      count,
      porcentaje: Math.round((count / sumSec) * 1000) / 10
    }))
    .sort((a, b) => b.count - a.count)

  const countUsuario: Record<string, number> = {}
  for (const ev of aperturas) {
    const u = (ev.nombre_usuario ?? '').trim() || 'Sin nombre'
    countUsuario[u] = (countUsuario[u] ?? 0) + 1
  }
  const sumU = Object.values(countUsuario).reduce((a, b) => a + b, 0) || 1
  const porUsuarioMarca = Object.entries(countUsuario)
    .map(([usuario, count]) => ({
      usuario,
      count,
      porcentaje: Math.round((count / sumU) * 1000) / 10
    }))
    .sort((a, b) => b.count - a.count)

  const countCreador: Record<string, number> = {}
  for (const r of rowsStats) {
    const creador = (r.orden?.nombre_creador ?? '').trim() || 'Sin dato'
    countCreador[creador] = (countCreador[creador] ?? 0) + 1
  }
  const sumCr = Object.values(countCreador).reduce((a, b) => a + b, 0) || 1
  const porCreadorOp = Object.entries(countCreador)
    .map(([creador, count]) => ({
      creador,
      count,
      porcentaje: Math.round((count / sumCr) * 1000) / 10
    }))
    .sort((a, b) => b.count - a.count)

  const countEtiquetas: Record<string, number> = {}
  for (const r of rowsStats) {
    for (const tag of parseEtiquetasOrden(r.orden)) {
      const key = tag.trim()
      if (!key) continue
      countEtiquetas[key] = (countEtiquetas[key] ?? 0) + 1
    }
  }
  const sumTag = Object.values(countEtiquetas).reduce((a, b) => a + b, 0) || 1
  const porEtiquetas = Object.entries(countEtiquetas)
    .map(([etiqueta, count]) => ({
      etiqueta,
      count,
      porcentaje: Math.round((count / sumTag) * 1000) / 10
    }))
    .sort((a, b) => b.count - a.count)

  let totalCostoExtraMonto = 0
  for (const r of rowsStats) {
    totalCostoExtraMonto += costoExtraOrdenMonto(r.orden)
  }

  const countMes: Record<string, number> = {}
  for (const ev of aperturas) {
    try {
      const d = new Date(ev.timestamp)
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      countMes[mes] = (countMes[mes] ?? 0) + 1
    } catch {
      /* skip */
    }
  }
  const porMesApertura = Object.entries(countMes)
    .map(([mes, count]) => ({ mes, count }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  const ciclosBucket: Record<string, number> = {}
  for (const r of rowsStats) {
    const key = r.ciclosReclamo >= 3 ? '3+' : String(Math.max(1, r.ciclosReclamo))
    ciclosBucket[key] = (ciclosBucket[key] ?? 0) + 1
  }
  const distribucionCiclos = ['1', '2', '3+']
    .filter((k) => ciclosBucket[k] != null)
    .map((ciclos) => ({ ciclos, ops: ciclosBucket[ciclos] ?? 0 }))

  const paresCierre: Array<{ ordenId: number; dias: number }> = []
  const byOrdenEv = new Map<number, HistorialMovimiento[]>()
  for (const ev of todosEventos) {
    const oid = ev.id_orden
    const arr = byOrdenEv.get(oid)
    if (arr) arr.push(ev)
    else byOrdenEv.set(oid, [ev])
  }
  for (const [oid, arr] of byOrdenEv) {
    arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    let lastApertura: HistorialMovimiento | null = null
    for (const ev of arr) {
      const k = classifyReclamoEvent(ev)
      if (k === 'apertura') {
        lastApertura = aperturaEnAmbitoProductivo(ev, ordenById) ? ev : null
      } else if (k === 'cierre' && lastApertura) {
        const ta = new Date(lastApertura.timestamp).getTime()
        if (ta >= desdeMs && ta <= hastaMs) {
          const t0 = ta
          const t1 = new Date(ev.timestamp).getTime()
          const dias = Math.max(0, (t1 - t0) / 86400000)
          paresCierre.push({ ordenId: oid, dias })
        }
        lastApertura = null
      }
    }
  }

  const diasArr = paresCierre.map((p) => p.dias)

  const now = Math.min(Date.now(), hastaMs)
  let diasPerdidosAcumulados = diasArr.reduce((a, d) => a + d, 0)
  for (const r of rowsStats) {
    if (!r.activo) continue
    const ts = r.tsUltimaApertura ?? r.tsPrimeraApertura
    if (!ts) continue
    const tOpen = new Date(ts).getTime()
    if (!Number.isFinite(tOpen)) continue
    diasPerdidosAcumulados += diasUnixOverlap(tOpen, now, desdeMs, hastaMs)
  }

  const mesKeysRango = mesKeysEntre(desdeMs, hastaMs)
  const costoPorMes: Record<string, number> = {}
  for (const r of rowsStats) {
    const tsU = r.tsUltimaApertura ?? r.tsPrimeraApertura
    if (!tsU) continue
    const d = new Date(tsU)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    costoPorMes[mk] = (costoPorMes[mk] ?? 0) + costoExtraOrdenMonto(r.orden)
  }
  const diasPorMes: Record<string, number> = {}
  for (const r of rowsStats) {
    const tsOpen = r.tsUltimaApertura ?? r.tsPrimeraApertura
    if (!tsOpen) continue
    const tOpen = new Date(tsOpen).getTime()
    const tClose = r.activo ? now : r.tsUltimoCierre ? new Date(r.tsUltimoCierre).getTime() : now
    if (!Number.isFinite(tOpen)) continue
    const rwA = Math.max(tOpen, desdeMs)
    const rwB = Math.min(tClose, hastaMs)
    if (rwB <= rwA) continue
    for (const mk of mesKeysRango) {
      const [ms, me] = boundsMes(mk)
      diasPorMes[mk] = (diasPorMes[mk] ?? 0) + diasUnixOverlap(rwA, rwB, ms, me)
    }
  }
  const mesKeysUnion = new Set<string>([
    ...mesKeysRango,
    ...Object.keys(countMes),
    ...Object.keys(costoPorMes),
    ...Object.keys(diasPorMes)
  ])
  const mesKeysSorted = [...mesKeysUnion].sort((a, b) => a.localeCompare(b))
  const detalleMensual = mesKeysSorted.map((mes) => ({
    mes,
    aperturas: countMes[mes] ?? 0,
    costoExtra: costoPorMes[mes] ?? 0,
    diasPerdidos: diasPorMes[mes] ?? 0
  }))

  return {
    ambitoProductivo: true,
    ordenesUnicasConReclamo,
    casosActivos,
    casosCerrados,
    totalAperturasHistoricas,
    opsConReclamoMultiple,
    aperturasMostradorSector,
    porEstadoKanban,
    porSector,
    porUsuarioMarca,
    porCreadorOp,
    porMesApertura,
    distribucionCiclos,
    tiempoResolucion: {
      mediaDias: mean(diasArr),
      medianaDias: median(diasArr),
      muestras: diasArr.length
    },
    diasPerdidosAcumulados,
    paresCierre,
    totalCostoExtraMonto,
    porEtiquetas,
    detalleMensual
  }
}

