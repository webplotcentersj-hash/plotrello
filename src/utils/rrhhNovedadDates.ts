import type { RrhhNovedad, RrhhNovedadGrupo, SolicitudPermiso } from '../types/api'

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
  licencia: 2,
  horas_extra: 3,
  parte_diario: 4,
  anticipacion_sueldo: 5,
  beneficio_comida: 6
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
  if (!p.fecha_inicio) return false
  const desde = String(p.fecha_inicio).slice(0, 10)
  const hasta = String(p.fecha_fin || p.fecha_inicio).slice(0, 10)
  return desde <= dayStr && hasta >= dayStr
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
    anticipacion_sueldo: 'Ant'
  }
  return map[codigo] ?? codigo.replace(/_/g, ' ').slice(0, 8)
}

export function esDiaHabil(dayStr: string): boolean {
  const [y, m, d] = dayStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow >= 1 && dow <= 6
}
