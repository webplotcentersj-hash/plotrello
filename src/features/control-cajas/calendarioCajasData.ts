import {
  fechasEnRangoPlanilla,
  planillaEnFecha,
  totalesEgresosPlanilla,
  totalesIngresosPlanilla
} from './cajaDashboardData'
import { fmtArs, fmtDateAr, montoVisibleMovimiento } from './format'
import { matchSearchQuery } from './listFilters'

export {
  buildMonthGrid,
  clampFechaToYearMonth,
  daysInYearMonth,
  labelMesAnio,
  parseYearMonth,
  shiftYearMonth,
  yearMonthFromDate
} from './calendarioCajasGrid'
import type {
  CajaArqueo,
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaRegistro,
  CajaTransferenciaLote,
  PlanillaCajaGuardada
} from './types'

export type DiaCalendarioCaja = {
  fecha: string
  ingreso: number
  egreso: number
  egresosPendientes: number
  cierresTurno: number
  planillas: number
  arqueos: number
  movimientos: number
  cajasSlugs: string[]
  searchText: string
}

export type CalendarioCajasIndex = Record<string, DiaCalendarioCaja>

function ensureDay(index: CalendarioCajasIndex, fecha: string): DiaCalendarioCaja {
  if (!index[fecha]) {
    index[fecha] = {
      fecha,
      ingreso: 0,
      egreso: 0,
      egresosPendientes: 0,
      cierresTurno: 0,
      planillas: 0,
      arqueos: 0,
      movimientos: 0,
      cajasSlugs: [],
      searchText: ''
    }
  }
  return index[fecha]
}

function addCajaSlug(day: DiaCalendarioCaja, slug: string | null | undefined) {
  if (!slug || day.cajasSlugs.includes(slug)) return
  day.cajasSlugs.push(slug)
}

function bumpMap(map: Map<string, number>, key: string, delta: number) {
  if (!key || !delta) return
  map.set(key, (map.get(key) || 0) + delta)
}

function ensureSlugSet(map: Map<string, Set<string>>, fecha: string): Set<string> {
  let set = map.get(fecha)
  if (!set) {
    set = new Set()
    map.set(fecha, set)
  }
  return set
}

function isDevolucionPlotLab(m: CajaMovimiento): boolean {
  if (m.anulado || m.tipo_movimiento !== 'egreso') return false
  return /PL-DEVOL-\d+/.test(`${m.observacion || ''} ${m.nro_comprobante || ''}`)
}

function isIngresoPlotLab(m: CajaMovimiento): boolean {
  return (
    !m.anulado &&
    m.tipo_movimiento === 'ingreso' &&
    m.origen_importacion === 'plotlab_venta' &&
    !!m.fecha
  )
}

/**
 * Índice por fecha con actividad de cajas.
 * Una sola pasada por colección (evita llamar resumenAdminHoy por cada día).
 */
export function buildCalendarioCajasIndex(
  lotes: CajaTransferenciaLote[],
  planillas: PlanillaCajaGuardada[],
  arqueos: CajaArqueo[],
  egresos: CajaEgresoSolicitud[],
  cajas: CajaRegistro[],
  movimientos: CajaMovimiento[] = []
): CalendarioCajasIndex {
  const index: CalendarioCajasIndex = {}
  const ingresoLotes = new Map<string, number>()
  const ingresoPlanilla = new Map<string, number>()
  const ingresoPlotLab = new Map<string, number>()
  const egresoAprobado = new Map<string, number>()
  const egresoDevolucion = new Map<string, number>()
  const egresoPlanilla = new Map<string, number>()
  const egresosPendientes = new Map<string, number>()
  const cierresTurno = new Map<string, number>()
  const slugsByFecha = new Map<string, Set<string>>()
  const lotesByFecha = new Map<string, CajaTransferenciaLote[]>()
  const planillasByFecha = new Map<string, PlanillaCajaGuardada[]>()
  const arqueosByFecha = new Map<string, CajaArqueo[]>()

  for (const l of lotes) {
    if (!l.fecha) continue
    const resto = (l.resto_efectivo || 0) + (l.resto_otros || 0)
    bumpMap(ingresoLotes, l.fecha, resto)
    bumpMap(cierresTurno, l.fecha, 1)
    const set = ensureSlugSet(slugsByFecha, l.fecha)
    if (l.origen_slug) set.add(l.origen_slug)
    if (l.caja_fondo_destino_slug) set.add(l.caja_fondo_destino_slug)
    const arr = lotesByFecha.get(l.fecha) || []
    arr.push(l)
    lotesByFecha.set(l.fecha, arr)
    ensureDay(index, l.fecha)
  }

  const planillasContadas = new Set<string>()
  for (const p of planillas) {
    for (const f of fechasEnRangoPlanilla(p)) {
      if (!planillaEnFecha(p, f)) continue
      ensureDay(index, f)
      const key = `${p.id}:${f}`
      if (!planillasContadas.has(key)) {
        const day = ensureDay(index, f)
        day.planillas += 1
        planillasContadas.add(key)
      }
      bumpMap(ingresoPlanilla, f, totalesIngresosPlanilla(p))
      bumpMap(egresoPlanilla, f, totalesEgresosPlanilla(p))
      if (p.caja_slug) ensureSlugSet(slugsByFecha, f).add(p.caja_slug)
      const arr = planillasByFecha.get(f) || []
      arr.push(p)
      planillasByFecha.set(f, arr)
    }
  }

  for (const a of arqueos) {
    if (!a.fecha) continue
    const day = ensureDay(index, a.fecha)
    day.arqueos += 1
    if (a.caja_slug) ensureSlugSet(slugsByFecha, a.fecha).add(a.caja_slug)
    const arr = arqueosByFecha.get(a.fecha) || []
    arr.push(a)
    arqueosByFecha.set(a.fecha, arr)
  }

  for (const e of egresos) {
    if (!e.fecha) continue
    ensureDay(index, e.fecha)
    if (e.caja_slug) ensureSlugSet(slugsByFecha, e.fecha).add(e.caja_slug)
    const pendiente = e.estado === 'pendiente' || (e.estado === 'aprobado' && !e.url_ticket)
    if (pendiente) bumpMap(egresosPendientes, e.fecha, 1)
    if (e.estado === 'aprobado' && e.url_ticket) {
      bumpMap(egresoAprobado, e.fecha, (e.monto_efectivo || 0) + (e.monto_otros || 0))
    }
  }

  for (const m of movimientos) {
    if (!m.fecha || m.anulado) continue
    const day = ensureDay(index, m.fecha)
    day.movimientos += 1
    if (m.origen_slug) ensureSlugSet(slugsByFecha, m.fecha).add(m.origen_slug)
    if (m.destino_slug) ensureSlugSet(slugsByFecha, m.fecha).add(m.destino_slug)

    if (isIngresoPlotLab(m)) {
      bumpMap(ingresoPlotLab, m.fecha, Number(m.monto_total) || 0)
    }
    if (isDevolucionPlotLab(m)) {
      bumpMap(egresoDevolucion, m.fecha, montoVisibleMovimiento(m))
    }
  }

  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug

  for (const day of Object.values(index)) {
    const f = day.fecha
    const loteIng = ingresoLotes.get(f) || 0
    const planIng = ingresoPlanilla.get(f) || 0
    const plotIng = ingresoPlotLab.get(f) || 0
    day.ingreso = loteIng > 0 ? loteIng : planIng > 0 ? planIng : plotIng

    let egreso = (egresoAprobado.get(f) || 0) + (egresoDevolucion.get(f) || 0)
    if (egreso <= 0) egreso = egresoPlanilla.get(f) || 0
    day.egreso = egreso
    day.egresosPendientes = egresosPendientes.get(f) || 0
    day.cierresTurno = cierresTurno.get(f) || 0

    const slugs = slugsByFecha.get(f)
    if (slugs) day.cajasSlugs = Array.from(slugs)

    const delDiaLotes = lotesByFecha.get(f) || []
    const delDiaPlanillas = planillasByFecha.get(f) || []
    const delDiaArqueos = arqueosByFecha.get(f) || []
    day.searchText = [
      day.fecha,
      fmtDateAr(day.fecha),
      fmtArs(day.ingreso),
      fmtArs(day.egreso),
      ...day.cajasSlugs.map(cajaNombre),
      ...delDiaLotes.map((l) => l.usuario_nombre ?? ''),
      ...delDiaLotes.map((l) => cajaNombre(l.origen_slug)),
      ...delDiaPlanillas.map((p) => p.archivo_nombre),
      ...delDiaPlanillas.map((p) => p.caja_nombre),
      ...delDiaPlanillas.map((p) => p.usuario_nombre ?? ''),
      ...delDiaArqueos.map((a) => a.usuario_nombre ?? ''),
      ...delDiaArqueos.map((a) => cajaNombre(a.caja_slug))
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  return index
}

export function filterFechasCalendario(
  index: CalendarioCajasIndex,
  q: string,
  yearMonth?: string
): string[] {
  const needle = q.trim().toLowerCase()
  let fechas = Object.keys(index).sort().reverse()
  if (yearMonth) {
    fechas = fechas.filter((f) => f.startsWith(yearMonth))
  }
  if (!needle) return fechas
  return fechas.filter((f) => {
    const day = index[f]
    return matchSearchQuery(needle, [day?.searchText, f, fmtDateAr(f)])
  })
}

export function dayHasActivity(day: DiaCalendarioCaja | undefined): boolean {
  if (!day) return false
  return (
    day.cierresTurno > 0 ||
    day.planillas > 0 ||
    day.arqueos > 0 ||
    day.movimientos > 0 ||
    day.ingreso > 0 ||
    day.egreso > 0 ||
    day.egresosPendientes > 0
  )
}
