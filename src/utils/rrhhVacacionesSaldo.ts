import type { RrhhNovedad, RrhhVacacionesAjuste, SolicitudPermiso } from '../types/api'

/** Días corridos de vacaciones LCT Argentina según años de antigüedad al 31/12 del año. */
export function diasCorrespondenPorAntiguedad(fechaIngreso: string | null | undefined, anio: number): number {
  if (!fechaIngreso) return 0
  const ingreso = new Date(`${fechaIngreso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(ingreso.getTime())) return 0
  const corte = new Date(anio, 11, 31, 12, 0, 0)
  if (ingreso > corte) return 0
  let years = corte.getFullYear() - ingreso.getFullYear()
  const m = corte.getMonth() - ingreso.getMonth()
  if (m < 0 || (m === 0 && corte.getDate() < ingreso.getDate())) years -= 1
  if (years < 0) return 0
  if (years < 5) return 14
  if (years < 10) return 21
  if (years < 20) return 28
  return 35
}

export function aniosAntiguedadAlCorte(fechaIngreso: string | null | undefined, anio: number): number {
  if (!fechaIngreso) return 0
  const ingreso = new Date(`${fechaIngreso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(ingreso.getTime())) return 0
  const corte = new Date(anio, 11, 31, 12, 0, 0)
  let years = corte.getFullYear() - ingreso.getFullYear()
  const m = corte.getMonth() - ingreso.getMonth()
  if (m < 0 || (m === 0 && corte.getDate() < ingreso.getDate())) years -= 1
  return Math.max(0, years)
}

function diasEntreInclusive(desde: string, hasta: string): number {
  const a = new Date(`${desde.slice(0, 10)}T12:00:00`)
  const b = new Date(`${hasta.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1
}

/** Días de un rango que caen dentro del año calendario. */
export function diasEnAnio(fechaDesde: string, fechaHasta: string, anio: number): number {
  const yearStart = `${anio}-01-01`
  const yearEnd = `${anio}-12-31`
  const d0 = fechaDesde.slice(0, 10)
  const d1 = fechaHasta.slice(0, 10)
  const desde = d0 < yearStart ? yearStart : d0
  const hasta = d1 > yearEnd ? yearEnd : d1
  if (desde > hasta) return 0
  return diasEntreInclusive(desde, hasta)
}

export type VacacionesTomadoItem = {
  fuente: 'solicitud' | 'novedad'
  id: number
  fecha_desde: string
  fecha_hasta: string
  dias: number
  titulo?: string
}

export function listarTomadosVacaciones(params: {
  anio: number
  idUsuario: number
  solicitudes: SolicitudPermiso[]
  novedades: RrhhNovedad[]
}): VacacionesTomadoItem[] {
  const { anio, idUsuario, solicitudes, novedades } = params
  const items: VacacionesTomadoItem[] = []
  const solicitudIdsConDias = new Set<number>()

  for (const s of solicitudes) {
    if (s.id_usuario !== idUsuario) continue
    if (s.tipo_solicitud !== 'vacaciones' || s.estado !== 'aprobado') continue
    if (!s.fecha_inicio || !s.fecha_fin) continue
    const dias =
      s.dias_solicitados != null && s.dias_solicitados > 0
        ? // si el pedido cruza años, proporcionalizar por días del año
          Math.min(
            Number(s.dias_solicitados),
            diasEnAnio(s.fecha_inicio, s.fecha_fin, anio)
          )
        : diasEnAnio(s.fecha_inicio, s.fecha_fin, anio)
    if (dias <= 0) continue
    solicitudIdsConDias.add(s.id)
    items.push({
      fuente: 'solicitud',
      id: s.id,
      fecha_desde: s.fecha_inicio.slice(0, 10),
      fecha_hasta: s.fecha_fin.slice(0, 10),
      dias,
      titulo: s.titulo
    })
  }

  for (const n of novedades) {
    if (n.id_usuario !== idUsuario) continue
    if (n.codigo !== 'licencia_vacaciones') continue
    // Evitar doble conteo si la novedad está ligada a una solicitud ya sumada
    if (n.id_solicitud_permiso != null && solicitudIdsConDias.has(n.id_solicitud_permiso)) continue
    const dias = diasEnAnio(n.fecha_desde, n.fecha_hasta, anio)
    if (dias <= 0) continue
    items.push({
      fuente: 'novedad',
      id: n.id,
      fecha_desde: n.fecha_desde.slice(0, 10),
      fecha_hasta: n.fecha_hasta.slice(0, 10),
      dias
    })
  }

  items.sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde))
  return items
}

export type SaldoVacacionesEmpleado = {
  id_usuario: number
  nombre: string
  fecha_ingreso: string | null
  anios: number
  corresponden: number
  tomados: number
  ajustes: number
  saldo: number
  tomadosDetalle: VacacionesTomadoItem[]
}

export function calcularSaldoVacaciones(params: {
  idUsuario: number
  nombre: string
  fechaIngreso: string | null | undefined
  anio: number
  solicitudes: SolicitudPermiso[]
  novedades: RrhhNovedad[]
  ajustes: RrhhVacacionesAjuste[]
}): SaldoVacacionesEmpleado {
  const corresponden = diasCorrespondenPorAntiguedad(params.fechaIngreso, params.anio)
  const anios = aniosAntiguedadAlCorte(params.fechaIngreso, params.anio)
  const tomadosDetalle = listarTomadosVacaciones({
    anio: params.anio,
    idUsuario: params.idUsuario,
    solicitudes: params.solicitudes,
    novedades: params.novedades
  })
  const tomados = tomadosDetalle.reduce((a, t) => a + t.dias, 0)
  const ajustes = params.ajustes
    .filter((x) => x.id_usuario === params.idUsuario && x.anio === params.anio)
    .reduce((a, x) => a + Number(x.dias_ajuste || 0), 0)
  return {
    id_usuario: params.idUsuario,
    nombre: params.nombre,
    fecha_ingreso: params.fechaIngreso ? params.fechaIngreso.slice(0, 10) : null,
    anios,
    corresponden,
    tomados,
    ajustes,
    saldo: corresponden + ajustes - tomados,
    tomadosDetalle
  }
}
