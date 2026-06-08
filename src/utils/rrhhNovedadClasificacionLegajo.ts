import { differenceInDays, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import type { RrhhNovedad } from '../types/api'

/** Clasificación de gestión RRHH para el legajo del colaborador. */
export type NovedadClasificacionLegajo =
  | 'ausencia_injustificada'
  | 'licencia_medica'
  | 'llegada_tarde'
  | 'sancion_disciplinaria'
  | 'perdida_beneficio'
  | 'accidente_incidente'
  | 'otra_administrativa'

export const CLASIFICACION_NOVEDAD_LEGajo: {
  value: NovedadClasificacionLegajo
  label: string
  icon: string
}[] = [
  { value: 'ausencia_injustificada', label: 'Ausencias injustificadas', icon: '❌' },
  { value: 'licencia_medica', label: 'Licencias médicas', icon: '🏥' },
  { value: 'llegada_tarde', label: 'Llegadas tarde', icon: '⏰' },
  { value: 'sancion_disciplinaria', label: 'Sanciones disciplinarias', icon: '⚠️' },
  { value: 'perdida_beneficio', label: 'Pérdida de beneficios', icon: '🚫' },
  { value: 'accidente_incidente', label: 'Accidentes / incidentes', icon: '🩹' },
  { value: 'otra_administrativa', label: 'Otras novedades administrativas', icon: '📋' }
]

const LABEL = new Map(CLASIFICACION_NOVEDAD_LEGajo.map((c) => [c.value, c.label]))
const ICON = new Map(CLASIFICACION_NOVEDAD_LEGajo.map((c) => [c.value, c.icon]))

export function etiquetaClasificacionNovedad(id: NovedadClasificacionLegajo): string {
  return LABEL.get(id) ?? id
}

export function iconoClasificacionNovedad(id: NovedadClasificacionLegajo): string {
  return ICON.get(id) ?? '📌'
}

export function clasificarNovedadLegajo(n: RrhhNovedad): NovedadClasificacionLegajo {
  if (n.codigo === 'falta_injustificada') return 'ausencia_injustificada'
  if (n.codigo === 'falta_justificada_enfermedad') return 'licencia_medica'
  if (n.codigo === 'tardanza') return 'llegada_tarde'
  if (n.codigo === 'retiro_anticipado') return 'sancion_disciplinaria'
  if (n.codigo === 'perdida_beneficio_comida') return 'perdida_beneficio'
  if (n.codigo === 'parte_diario') return 'accidente_incidente'

  const obs = (n.observaciones ?? '').toLowerCase()
  if (
    n.grupo === 'licencia' &&
    (obs.includes('médic') ||
      obs.includes('medic') ||
      obs.includes('enferm') ||
      obs.includes('certificado') ||
      obs.includes('art'))
  ) {
    return 'licencia_medica'
  }

  if (n.grupo === 'falta') return 'otra_administrativa'

  return 'otra_administrativa'
}

export function diasNovedad(n: RrhhNovedad): number {
  try {
    const desde = parseISO(n.fecha_desde.slice(0, 10))
    const hasta = parseISO(n.fecha_hasta.slice(0, 10))
    return Math.max(1, differenceInDays(hasta, desde) + 1)
  } catch {
    return 1
  }
}

export function diasNovedadEnMes(n: RrhhNovedad, ref: Date = new Date()): number {
  try {
    const inicioMes = startOfMonth(ref)
    const finMes = endOfMonth(ref)
    const desde = parseISO(n.fecha_desde.slice(0, 10))
    const hasta = parseISO(n.fecha_hasta.slice(0, 10))
    if (hasta < inicioMes || desde > finMes) return 0
    const overlapDesde = desde < inicioMes ? inicioMes : desde
    const overlapHasta = hasta > finMes ? finMes : hasta
    return Math.max(1, differenceInDays(overlapHasta, overlapDesde) + 1)
  } catch {
    return 0
  }
}

export function novedadEnMes(n: RrhhNovedad, ref: Date = new Date()): boolean {
  try {
    const inicioMes = startOfMonth(ref)
    const finMes = endOfMonth(ref)
    const desde = parseISO(n.fecha_desde.slice(0, 10))
    const hasta = parseISO(n.fecha_hasta.slice(0, 10))
    return (
      isWithinInterval(desde, { start: inicioMes, end: finMes }) ||
      isWithinInterval(hasta, { start: inicioMes, end: finMes }) ||
      (desde <= inicioMes && hasta >= finMes)
    )
  } catch {
    return false
  }
}

export function esLicenciaMedica(n: RrhhNovedad): boolean {
  return clasificarNovedadLegajo(n) === 'licencia_medica'
}

export function esAusencia(n: RrhhNovedad): boolean {
  const c = clasificarNovedadLegajo(n)
  return (
    c === 'ausencia_injustificada' ||
    c === 'licencia_medica' ||
    n.grupo === 'falta' ||
    (n.grupo === 'licencia' && n.codigo !== 'licencia_vacaciones')
  )
}

export function esDisciplinaria(n: RrhhNovedad): boolean {
  const c = clasificarNovedadLegajo(n)
  return (
    c === 'sancion_disciplinaria' ||
    c === 'ausencia_injustificada' ||
    c === 'perdida_beneficio'
  )
}
