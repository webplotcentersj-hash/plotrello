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
  ordenesUnicasConReclamo: number
  casosActivos: number
  casosCerrados: number
  /** Cada fila = una apertura de reclamo */
  totalAperturasHistoricas: number
  opsConReclamoMultiple: number
  porEstadoKanban: Array<{ estado: string; count: number; porcentaje: number }>
  porSector: Array<{ sector: string; count: number; porcentaje: number }>
  porUsuarioMarca: Array<{ usuario: string; count: number; porcentaje: number }>
  porMesApertura: Array<{ mes: string; count: number }>
  distribucionCiclos: Array<{ ciclos: string; ops: number }>
  tiempoResolucion: {
    mediaDias: number | null
    medianaDias: number | null
    muestras: number
  }
  /** Para cada OP cerrada en el período: días hasta cierre del último ciclo */
  paresCierre: Array<{ ordenId: number; dias: number }>
}

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
  columns: ColumnConfig[]
): {
  rows: IncidenciaReclamoRow[]
  stats: IncidenciasEstadisticas
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

  const stats = computeEstadisticas(rows, eventos, columns)

  return { rows, stats }
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

function orderPorEstadoComoTablero(
  items: Array<{ estado: string; count: number; porcentaje: number }>,
  columns: ColumnConfig[]
): Array<{ estado: string; count: number; porcentaje: number }> {
  const order = new Map(columns.map((c, i) => [c.label.trim().toLowerCase(), i]))
  return [...items].sort((a, b) => {
    const ia = order.get(a.estado.trim().toLowerCase())
    const ib = order.get(b.estado.trim().toLowerCase())
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined) return -1
    if (ib !== undefined) return 1
    return b.count - a.count
  })
}

function computeEstadisticas(
  rows: IncidenciaReclamoRow[],
  todosEventos: HistorialMovimiento[],
  columns: ColumnConfig[]
): IncidenciasEstadisticas {
  const casosActivos = rows.filter((r) => r.activo).length
  const casosCerrados = rows.filter((r) => !r.activo).length
  const ordenesUnicasConReclamo = rows.length

  const aperturas: HistorialMovimiento[] = []
  for (const ev of todosEventos) {
    if (classifyReclamoEvent(ev) === 'apertura') aperturas.push(ev)
  }
  const totalAperturasHistoricas = aperturas.length

  const ciclosPorOrden = new Map<number, number>()
  for (const r of rows) ciclosPorOrden.set(r.ordenId, r.ciclosReclamo)
  const opsConReclamoMultiple = [...ciclosPorOrden.values()].filter((n) => n > 1).length

  const countEstado: Record<string, number> = {}
  for (const ev of aperturas) {
    const lab = pickLabelEstadoParaStats(ev)
    countEstado[lab] = (countEstado[lab] ?? 0) + 1
  }
  const sumEst = Object.values(countEstado).reduce((a, b) => a + b, 0) || 1
  const porEstadoKanban = orderPorEstadoComoTablero(
    Object.entries(countEstado).map(([estado, count]) => ({
      estado,
      count,
      porcentaje: Math.round((count / sumEst) * 1000) / 10
    })),
    columns
  )

  const countSector: Record<string, number> = {}
  for (const r of rows) {
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
  for (const r of rows) {
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
      if (k === 'apertura') lastApertura = ev
      else if (k === 'cierre' && lastApertura) {
        const t0 = new Date(lastApertura.timestamp).getTime()
        const t1 = new Date(ev.timestamp).getTime()
        const dias = Math.max(0, (t1 - t0) / 86400000)
        paresCierre.push({ ordenId: oid, dias })
        lastApertura = null
      }
    }
  }

  const diasArr = paresCierre.map((p) => p.dias)

  return {
    ordenesUnicasConReclamo,
    casosActivos,
    casosCerrados,
    totalAperturasHistoricas,
    opsConReclamoMultiple,
    porEstadoKanban,
    porSector,
    porUsuarioMarca,
    porMesApertura,
    distribucionCiclos,
    tiempoResolucion: {
      mediaDias: mean(diasArr),
      medianaDias: median(diasArr),
      muestras: diasArr.length
    },
    paresCierre
  }
}

