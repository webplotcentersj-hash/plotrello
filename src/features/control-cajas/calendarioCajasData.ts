import { planillaEnFecha, resumenAdminHoy } from './cajaDashboardData'
import { fmtArs, fmtDateAr } from './format'
import { matchSearchQuery } from './listFilters'
import type {
  CajaArqueo,
  CajaEgresoSolicitud,
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

function finalizeSearchText(
  day: DiaCalendarioCaja,
  cajas: CajaRegistro[],
  lotes: CajaTransferenciaLote[],
  planillas: PlanillaCajaGuardada[],
  arqueos: CajaArqueo[]
) {
  const cajaNombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug
  const delDiaLotes = lotes.filter((l) => l.fecha === day.fecha)
  const delDiaPlanillas = planillas.filter((p) => planillaEnFecha(p, day.fecha))
  const delDiaArqueos = arqueos.filter((a) => a.fecha === day.fecha)

  const fields = [
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
  day.searchText = fields.filter(Boolean).join(' ').toLowerCase()
}

/** Índice por fecha con actividad de cajas (cierres, planillas, arqueos, egresos). */
export function buildCalendarioCajasIndex(
  lotes: CajaTransferenciaLote[],
  planillas: PlanillaCajaGuardada[],
  arqueos: CajaArqueo[],
  egresos: CajaEgresoSolicitud[],
  cajas: CajaRegistro[]
): CalendarioCajasIndex {
  const index: CalendarioCajasIndex = {}
  const fechas = new Set<string>()

  for (const l of lotes) {
    if (l.fecha) fechas.add(l.fecha)
  }
  for (const p of planillas) {
    const f = p.fecha_hasta || p.fecha_desde
    if (f) fechas.add(f)
  }
  for (const a of arqueos) {
    if (a.fecha) fechas.add(a.fecha)
  }
  for (const e of egresos) {
    if (e.fecha) fechas.add(e.fecha)
  }

  for (const fecha of fechas) {
    const resumen = resumenAdminHoy(fecha, lotes, planillas, egresos, cajas)
    const day = ensureDay(index, fecha)
    day.ingreso = resumen.ingresoHoy
    day.egreso = resumen.egresosHoy
    day.egresosPendientes = resumen.egresosPendientes
    day.cierresTurno = resumen.cierresTurnoHoy.length

    for (const l of resumen.cierresTurnoHoy) {
      addCajaSlug(day, l.origen_slug)
      addCajaSlug(day, l.caja_fondo_destino_slug)
    }
  }

  for (const p of planillas) {
    const f = p.fecha_hasta || p.fecha_desde
    if (!f) continue
    const day = ensureDay(index, f)
    day.planillas += 1
    addCajaSlug(day, p.caja_slug)
  }

  for (const a of arqueos) {
    if (!a.fecha) continue
    const day = ensureDay(index, a.fecha)
    day.arqueos += 1
    addCajaSlug(day, a.caja_slug)
  }

  for (const e of egresos) {
    if (!e.fecha) continue
    const day = ensureDay(index, e.fecha)
    if (e.estado === 'pendiente') day.egresosPendientes += 1
    addCajaSlug(day, e.caja_slug)
  }

  for (const day of Object.values(index)) {
    finalizeSearchText(day, cajas, lotes, planillas, arqueos)
  }

  return index
}

export function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y || new Date().getFullYear(), month: m || 1 }
}

export function yearMonthFromDate(fecha: string): string {
  return fecha.slice(0, 7)
}

/** Celdas del mes (null = padding). Semana empieza lunes. */
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const padStart = (firstDow + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < padStart; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push(`${year}-${mm}-${dd}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
]

export function labelMesAnio(year: number, month: number): string {
  return `${MESES_ES[month - 1] ?? ''} ${year}`
}

export function shiftYearMonth(ym: string, delta: number): string {
  const { year, month } = parseYearMonth(ym)
  const d = new Date(year, month - 1 + delta, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
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
    day.ingreso > 0 ||
    day.egreso > 0 ||
    day.egresosPendientes > 0
  )
}
