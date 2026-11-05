import type { RrhhNovedad, RrhhVacacionesAjuste, SolicitudPermiso } from '../types/api'

/**
 * Vacaciones — Ley de Contrato de Trabajo (Argentina) arts. 150 y 151.
 * Cupo en días corridos según antigüedad al 31/12 del año liquidado.
 * Si en ese año no alcanzó ~6 meses de prestación, art. 151: 1 día cada 20 días.
 *
 * Período habitual de goce (práctica Plot / LCT art. 154): desde diciembre del año
 * liquidado hasta abril del año siguiente.
 */

/** Ventana de goce visual: 1 dic (año) → 30 abr (año+1). */
export function periodoGoceVacaciones(anioLiquidado: number): { desde: string; hasta: string } {
  return {
    desde: `${anioLiquidado}-12-01`,
    hasta: `${anioLiquidado + 1}-04-30`
  }
}

/** Meses del calendario de goce (dic → abr). */
export function mesesCalendarioGoce(anioLiquidado: number): { anio: number; mes: number }[] {
  return [
    { anio: anioLiquidado, mes: 11 },
    { anio: anioLiquidado + 1, mes: 0 },
    { anio: anioLiquidado + 1, mes: 1 },
    { anio: anioLiquidado + 1, mes: 2 },
    { anio: anioLiquidado + 1, mes: 3 }
  ]
}

export type VacacionesPeriodoCalendario = {
  key: string
  idUsuario: number
  nombre: string
  fecha_desde: string
  fecha_hasta: string
  dias: number
  fuente: 'solicitud' | 'novedad'
}

/** Une tomados de todos los empleados que intersectan la ventana de goce. */
export function listarPeriodosCalendarioGoce(params: {
  anioLiquidado: number
  saldos: Array<{ id_usuario: number; nombre: string }>
  solicitudes: SolicitudPermiso[]
  novedades: RrhhNovedad[]
}): VacacionesPeriodoCalendario[] {
  const { desde, hasta } = periodoGoceVacaciones(params.anioLiquidado)
  const out: VacacionesPeriodoCalendario[] = []

  for (const emp of params.saldos) {
    const items = listarTomadosEnVentana({
      idUsuario: emp.id_usuario,
      desde,
      hasta,
      solicitudes: params.solicitudes,
      novedades: params.novedades
    })
    for (const t of items) {
      out.push({
        key: `${t.fuente}-${t.id}`,
        idUsuario: emp.id_usuario,
        nombre: emp.nombre,
        fecha_desde: t.fecha_desde,
        fecha_hasta: t.fecha_hasta,
        dias: t.dias,
        fuente: t.fuente
      })
    }
  }

  out.sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde) || a.nombre.localeCompare(b.nombre, 'es'))
  return out
}

function listarTomadosEnVentana(params: {
  idUsuario: number
  desde: string
  hasta: string
  solicitudes: SolicitudPermiso[]
  novedades: RrhhNovedad[]
}): VacacionesTomadoItem[] {
  const { idUsuario, desde, hasta, solicitudes, novedades } = params
  const items: VacacionesTomadoItem[] = []
  const solicitudIds = new Set<number>()

  for (const s of solicitudes) {
    if (s.id_usuario !== idUsuario) continue
    if (s.tipo_solicitud !== 'vacaciones' || s.estado !== 'aprobado') continue
    if (!s.fecha_inicio || !s.fecha_fin) continue
    const d0 = s.fecha_inicio.slice(0, 10)
    const d1 = s.fecha_fin.slice(0, 10)
    if (d1 < desde || d0 > hasta) continue
    const clipDesde = d0 < desde ? desde : d0
    const clipHasta = d1 > hasta ? hasta : d1
    const dias = diasEntreInclusive(clipDesde, clipHasta)
    if (dias <= 0) continue
    solicitudIds.add(s.id)
    items.push({
      fuente: 'solicitud',
      id: s.id,
      fecha_desde: d0,
      fecha_hasta: d1,
      dias,
      titulo: s.titulo
    })
  }

  for (const n of novedades) {
    if (n.id_usuario !== idUsuario) continue
    if (n.codigo !== 'licencia_vacaciones') continue
    if (n.id_solicitud_permiso != null && solicitudIds.has(n.id_solicitud_permiso)) continue
    const d0 = n.fecha_desde.slice(0, 10)
    const d1 = n.fecha_hasta.slice(0, 10)
    if (d1 < desde || d0 > hasta) continue
    const clipDesde = d0 < desde ? desde : d0
    const clipHasta = d1 > hasta ? hasta : d1
    const dias = diasEntreInclusive(clipDesde, clipHasta)
    if (dias <= 0) continue
    items.push({
      fuente: 'novedad',
      id: n.id,
      fecha_desde: d0,
      fecha_hasta: d1,
      dias
    })
  }

  return items
}

/** Mitad del año calendario ≈ 6 meses (criterio usual para el mínimo del art. 150). */
export const LCT_MINIMO_DIAS_ANO_PARA_CUPO_COMPLETO = 182

/** Tramos art. 150 LCT (días corridos). */
export function cupoLctPorAnios(anios: number): number {
  if (anios < 0) return 0
  if (anios <= 5) return 14
  if (anios <= 10) return 21
  if (anios <= 20) return 28
  return 35
}

function parseFechaLocal(iso: string): Date | null {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function aniosAntiguedadAlCorte(fechaIngreso: string | null | undefined, anio: number): number {
  if (!fechaIngreso) return 0
  const ingreso = parseFechaLocal(fechaIngreso)
  if (!ingreso) return 0
  const corte = new Date(anio, 11, 31, 12, 0, 0)
  if (ingreso > corte) return 0
  let years = corte.getFullYear() - ingreso.getFullYear()
  const m = corte.getMonth() - ingreso.getMonth()
  if (m < 0 || (m === 0 && corte.getDate() < ingreso.getDate())) years -= 1
  return Math.max(0, years)
}

/** Días corridos de vínculo laboral dentro del año calendario (desde ingreso o 1/1). */
export function diasPrestacionEnAnio(fechaIngreso: string | null | undefined, anio: number): number {
  if (!fechaIngreso) return 0
  const ingreso = parseFechaLocal(fechaIngreso)
  if (!ingreso) return 0
  const yearStart = new Date(anio, 0, 1, 12, 0, 0)
  const yearEnd = new Date(anio, 11, 31, 12, 0, 0)
  if (ingreso > yearEnd) return 0
  const desde = ingreso > yearStart ? ingreso : yearStart
  return Math.floor((yearEnd.getTime() - desde.getTime()) / 86400000) + 1
}

export type BaseLegalVacaciones = 'art150' | 'art151' | 'sin_ingreso' | 'sin_prestacion'

export function calcularCupoVacacionesLct(
  fechaIngreso: string | null | undefined,
  anio: number
): { corresponden: number; anios: number; baseLegal: BaseLegalVacaciones; diasPrestacion: number } {
  if (!fechaIngreso) {
    return { corresponden: 0, anios: 0, baseLegal: 'sin_ingreso', diasPrestacion: 0 }
  }
  const anios = aniosAntiguedadAlCorte(fechaIngreso, anio)
  const diasPrestacion = diasPrestacionEnAnio(fechaIngreso, anio)
  if (diasPrestacion <= 0) {
    return { corresponden: 0, anios, baseLegal: 'sin_prestacion', diasPrestacion: 0 }
  }
  if (diasPrestacion < LCT_MINIMO_DIAS_ANO_PARA_CUPO_COMPLETO) {
    return {
      corresponden: Math.floor(diasPrestacion / 20),
      anios,
      baseLegal: 'art151',
      diasPrestacion
    }
  }
  return {
    corresponden: cupoLctPorAnios(anios),
    anios,
    baseLegal: 'art150',
    diasPrestacion
  }
}

/** @deprecated Preferir `calcularCupoVacacionesLct` — mantiene compatibilidad. */
export function diasCorrespondenPorAntiguedad(
  fechaIngreso: string | null | undefined,
  anio: number
): number {
  return calcularCupoVacacionesLct(fechaIngreso, anio).corresponden
}

export function diasEntreInclusive(desde: string, hasta: string): number {
  const a = parseFechaLocal(desde)
  const b = parseFechaLocal(hasta)
  if (!a || !b || b < a) return 0
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
        ? Math.min(Number(s.dias_solicitados), diasEnAnio(s.fecha_inicio, s.fecha_fin, anio))
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
  baseLegal: BaseLegalVacaciones
  diasPrestacion: number
}

export function etiquetaBaseLegalVacaciones(base: BaseLegalVacaciones): string {
  switch (base) {
    case 'art150':
      return 'Art. 150 LCT (cupo completo)'
    case 'art151':
      return 'Art. 151 LCT (proporcional: 1 día cada 20)'
    case 'sin_ingreso':
      return 'Sin fecha de ingreso en legajo'
    case 'sin_prestacion':
      return 'Sin prestación en el año'
    default:
      return base
  }
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
  const cupo = calcularCupoVacacionesLct(params.fechaIngreso, params.anio)
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
    anios: cupo.anios,
    corresponden: cupo.corresponden,
    tomados,
    ajustes,
    saldo: cupo.corresponden + ajustes - tomados,
    tomadosDetalle,
    baseLegal: cupo.baseLegal,
    diasPrestacion: cupo.diasPrestacion
  }
}
