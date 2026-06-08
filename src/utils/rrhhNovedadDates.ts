import type { RrhhNovedad, SolicitudPermiso } from '../types/api'

export function novedadEnDia(n: RrhhNovedad, dayStr: string): boolean {
  return n.fecha_desde <= dayStr && n.fecha_hasta >= dayStr
}

export function permisoEnDia(p: SolicitudPermiso, dayStr: string): boolean {
  if (!p.fecha_inicio) return false
  const desde = p.fecha_inicio.slice(0, 10)
  const hasta = (p.fecha_fin || p.fecha_inicio).slice(0, 10)
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
