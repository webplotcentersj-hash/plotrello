import type { RrhhNovedad, RrhhNovedadGrupo, SolicitudPermiso } from '../types/api'
import { esFeriado } from './feriadosArgentina'

export function novedadEnDia(n: RrhhNovedad, dayStr: string): boolean {
  return n.fecha_desde <= dayStr && n.fecha_hasta >= dayStr
}

/** Si la novedad debe mostrarse como chip en un día del calendario mensual. */
export function novedadVisibleEnCalendarioDia(n: RrhhNovedad, dayStr: string): boolean {
  if (!novedadEnDia(n, dayStr)) return false
  // Pérdida de beneficio comida: vigencia mensual, se marca solo el día de inicio.
  if (n.grupo === 'beneficio_comida' && n.codigo === 'perdida_beneficio_comida') {
    return n.fecha_desde === dayStr
  }
  return true
}

const PRIORIDAD_CALENDARIO: Partial<Record<RrhhNovedadGrupo, number>> = {
  tardanza_retiro: 0,
  falta: 1,
  suspension: 2,
  licencia: 3,
  horas_extra: 4,
  parte_diario: 5,
  anticipacion_sueldo: 6,
  beneficio_comida: 7
}

/** Orden de chips: tardanzas y faltas primero; dentro del grupo, más recientes arriba. */
export function ordenarNovedadesCalendario(list: RrhhNovedad[]): RrhhNovedad[] {
  return [...list].sort((a, b) => {
    const pa = PRIORIDAD_CALENDARIO[a.grupo] ?? 9
    const pb = PRIORIDAD_CALENDARIO[b.grupo] ?? 9
    if (pa !== pb) return pa - pb
    if (a.grupo === 'tardanza_retiro' && b.grupo === 'tardanza_retiro') {
      const ma = a.duracion_minutos ?? 0
      const mb = b.duracion_minutos ?? 0
      if (ma !== mb) return mb - ma
    }
    return b.id - a.id
  })
}

/** Etiqueta corta para chips del calendario (incluye minutos de tardanza). */
export function etiquetaCortaChipCalendario(n: RrhhNovedad): string {
  if (n.grupo === 'tardanza_retiro' && n.codigo === 'tardanza' && n.duracion_minutos != null) {
    return `T ${n.duracion_minutos}′`
  }
  return abreviaturaCodigoNovedad(n.codigo)
}

/** Novedad activa de pérdida de beneficio de comida para un empleado en una fecha (YYYY-MM-DD). */
export function findPerdidaBeneficioComidaActiva(
  novedades: RrhhNovedad[],
  idUsuario: number,
  dayStr: string
): RrhhNovedad | null {
  for (const n of novedades) {
    if (
      n.id_usuario === idUsuario &&
      n.grupo === 'beneficio_comida' &&
      n.codigo === 'perdida_beneficio_comida' &&
      novedadEnDia(n, dayStr)
    ) {
      return n
    }
  }
  return null
}

export function permisoEnDia(p: SolicitudPermiso, dayStr: string): boolean {
  // Misma regla que liquidación: fallback a fecha_solicitud si falta inicio.
  const desde = String(p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return false
  let hasta = String(p.fecha_fin || p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde) hasta = desde
  // Evitar typos de año (ej. 20206) que pintan meses enteros.
  const y0 = Number(desde.slice(0, 4))
  const y1 = Number(hasta.slice(0, 4))
  if (y0 < 2000 || y0 > 2100 || y1 < 2000 || y1 > 2100 || y1 - y0 > 1) {
    hasta = desde
  }
  return desde <= dayStr && hasta >= dayStr
}

/** Permisos que explican ausencia (igual que falta justificada / licencia). */
export function esPermisoAsistenciaCalendario(p: SolicitudPermiso): boolean {
  if (p.estado !== 'aprobado') return false
  if (p.tipo_solicitud === 'turno' || p.tipo_solicitud === 'ropa') return false
  return true
}

export function permisoVisibleEnCalendarioDia(
  p: SolicitudPermiso,
  dayStr: string,
  novedades: RrhhNovedad[] = []
): boolean {
  if (!esPermisoAsistenciaCalendario(p) || !permisoEnDia(p, dayStr)) return false
  // Si ya hay novedad vinculada a este permiso ese día, no duplicar el chip.
  if (novedades.some((n) => n.id_solicitud_permiso === p.id && novedadEnDia(n, dayStr))) return false
  return true
}

export function etiquetaCortaPermisoCalendario(p: SolicitudPermiso): string {
  switch (p.tipo_solicitud) {
    case 'vacaciones':
      return 'Vac'
    case 'ausencia':
      return 'Aus'
    case 'permiso':
      return 'Perm'
    case 'otro':
      return 'Sol'
    default:
      return 'Perm'
  }
}

export function etiquetaTipoPermisoCalendario(p: SolicitudPermiso): string {
  switch (p.tipo_solicitud) {
    case 'vacaciones':
      return 'Vacaciones (aprobadas)'
    case 'ausencia':
      return 'Ausencia (aprobada)'
    case 'permiso':
      return 'Permiso (aprobado)'
    case 'otro':
      return 'Solicitud (aprobada)'
    default:
      return `Solicitud ${p.tipo_solicitud} (aprobada)`
  }
}

/** Etiqueta corta para celdas de planilla de asistencia. */
export function abreviaturaCodigoNovedad(codigo: string): string {
  const map: Record<string, string> = {
    falta_injustificada: 'F.I.',
    falta_justificada_enfermedad: 'F.J.',
    falta_justificada_tramites: 'F.tr',
    tardanza: 'Tarde',
    retiro_anticipado: 'R.A.',
    licencia_vacaciones: 'Vac',
    licencia_examen: 'Exam',
    licencia_maternidad: 'Mat',
    licencia_paternidad: 'Pat',
    licencia_casamiento: 'Cas',
    licencia_otro: 'Lic',
    horas_extra_50: 'HE50',
    horas_extra_100: 'HE100',
    perdida_beneficio_comida: 'Com',
    parte_diario: 'PD',
    anticipacion_sueldo: 'Ant',
    suspension: 'Susp',
    restituir_jornada: 'J.comp'
  }
  return map[codigo] ?? codigo.replace(/_/g, ' ').slice(0, 8)
}

export function esDiaHabil(dayStr: string): boolean {
  const [y, m, d] = dayStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  // Domingo no es hábil. Feriados/puentes AR tampoco (no exigen marca ni son falta).
  if (dow === 0) return false
  if (esFeriado(dayStr.slice(0, 10))) return false
  return dow >= 1 && dow <= 6
}
