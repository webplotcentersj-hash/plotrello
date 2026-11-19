import type { RrhhNovedadGrupo, SolicitudPermiso } from '../types/api'

export type MapeoNovedadDesdePermiso = {
  grupo: RrhhNovedadGrupo
  codigo: string
  /** Día completo → marcar asistencia justificada (ausencia/vacaciones). */
  diaCompleto: boolean
}

/** Tipos que afectan asistencia / liquidación (no turno ni ropa). */
export function solicitudImpactaAsistencia(tipo: SolicitudPermiso['tipo_solicitud']): boolean {
  return tipo === 'ausencia' || tipo === 'vacaciones' || tipo === 'permiso' || tipo === 'otro'
}

function ymdValido(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number(s.slice(0, 4)) >= 2000 && Number(s.slice(0, 4)) <= 2100
}

/** Rango de fechas de la solicitud (YYYY-MM-DD), con fallback a fecha_solicitud. */
export function rangoFechasSolicitud(s: Pick<SolicitudPermiso, 'fecha_inicio' | 'fecha_fin' | 'fecha_solicitud'>): {
  desde: string
  hasta: string
} | null {
  const desdeRaw = String(s.fecha_inicio || s.fecha_solicitud || '').slice(0, 10)
  if (!ymdValido(desdeRaw)) return null
  let hastaRaw = String(s.fecha_fin || s.fecha_inicio || s.fecha_solicitud || '').slice(0, 10)
  if (!ymdValido(hastaRaw) || hastaRaw < desdeRaw) hastaRaw = desdeRaw
  // Typo de año (ej. 20206) o rangos absurdos: acotar a 45 días.
  const maxMs = 45 * 24 * 60 * 60 * 1000
  const d0 = new Date(`${desdeRaw}T12:00:00`)
  const d1 = new Date(`${hastaRaw}T12:00:00`)
  if (Number.isFinite(d0.getTime()) && Number.isFinite(d1.getTime()) && d1.getTime() - d0.getTime() > maxMs) {
    hastaRaw = desdeRaw
  }
  return { desde: desdeRaw, hasta: hastaRaw }
}

/** Lista inclusiva de días YYYY-MM-DD entre desde y hasta. */
export function diasEntreInclusive(desde: string, hasta: string): string[] {
  const out: string[] = []
  const cur = new Date(`${desde}T12:00:00`)
  const end = new Date(`${hasta}T12:00:00`)
  if (!Number.isFinite(cur.getTime()) || !Number.isFinite(end.getTime()) || end < cur) return out
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/**
 * Mapea el tipo/título de la solicitud a novedad RRHH.
 * Vacaciones → licencia; ausencia/enfermedad → falta justificada; retiro temprano → retiro anticipado.
 */
export function mapearSolicitudANovedad(
  s: Pick<SolicitudPermiso, 'tipo_solicitud' | 'titulo' | 'descripcion'>
): MapeoNovedadDesdePermiso | null {
  if (!solicitudImpactaAsistencia(s.tipo_solicitud)) return null
  if (s.tipo_solicitud === 'vacaciones') {
    return { grupo: 'licencia', codigo: 'licencia_vacaciones', diaCompleto: true }
  }
  const texto = `${s.titulo || ''} ${s.descripcion || ''}`.toLowerCase()
  if (/enferm|m[eé]dic|consulta\s*m[eé]dica|certificado/.test(texto)) {
    return { grupo: 'falta', codigo: 'falta_justificada_enfermedad', diaCompleto: true }
  }
  if (
    s.tipo_solicitud === 'permiso' &&
    /retir|tempran|salida\s*anticip|media\s*jornada|salir\s*antes|antes\s*de\s*hora/.test(texto)
  ) {
    return { grupo: 'tardanza_retiro', codigo: 'retiro_anticipado', diaCompleto: false }
  }
  if (s.tipo_solicitud === 'ausencia') {
    return { grupo: 'falta', codigo: 'falta_justificada_tramites', diaCompleto: true }
  }
  // permiso genérico / otro: justificado para no descontar en liquidación
  return { grupo: 'falta', codigo: 'falta_justificada_tramites', diaCompleto: true }
}

export function observacionesNovedadDesdePermiso(s: Pick<SolicitudPermiso, 'id' | 'titulo' | 'descripcion'>): string {
  const base = (s.titulo || 'Solicitud aprobada').trim()
  const extra = (s.descripcion || '').trim()
  const cola = `Vinculada a solicitud #${s.id} (aprobada).`
  return extra ? `${base}. ${extra} ${cola}` : `${base}. ${cola}`
}
