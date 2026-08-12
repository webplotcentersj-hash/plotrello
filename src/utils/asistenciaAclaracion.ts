/** Marcador en `asistencia.observaciones` para notas de RRHH (no pisa el texto del reloj). */
export const ACLARACION_MARKER = '[ACLARACIÓN]'

export function parseAsistenciaObservaciones(obs: string | null | undefined): {
  sistema: string
  aclaracion: string
} {
  const raw = (obs || '').trim()
  if (!raw) return { sistema: '', aclaracion: '' }
  const idx = raw.indexOf(ACLARACION_MARKER)
  if (idx < 0) return { sistema: raw, aclaracion: '' }
  return {
    sistema: raw.slice(0, idx).trim(),
    aclaracion: raw.slice(idx + ACLARACION_MARKER.length).trim()
  }
}

export function joinAsistenciaObservaciones(sistema: string, aclaracion: string): string | null {
  const s = sistema.trim()
  const a = aclaracion.trim()
  if (!s && !a) return null
  if (!a) return s
  if (!s) return `${ACLARACION_MARKER} ${a}`
  return `${s}\n${ACLARACION_MARKER} ${a}`
}

export function tieneAclaracionAsistencia(obs: string | null | undefined): boolean {
  return Boolean(parseAsistenciaObservaciones(obs).aclaracion)
}
