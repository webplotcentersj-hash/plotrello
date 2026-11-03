import type { RrhhNovedad } from '../types/api'
import { novedadEnDia } from './rrhhNovedadDates'

/** Día siguiente en calendario local (YYYY-MM-DD). */
export function diaSiguienteIso(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function esNovedadSuspension(n: RrhhNovedad): boolean {
  return n.grupo === 'suspension' && n.codigo === 'suspension'
}

export function esNovedadRestituirJornada(n: RrhhNovedad): boolean {
  return n.grupo === 'suspension' && n.codigo === 'restituir_jornada'
}

/** Día cubierto por una suspensión (sin prestación / descuenta valor día). */
export function diaEnSuspension(
  novedades: RrhhNovedad[],
  idUsuario: number,
  fecha: string
): boolean {
  return novedades.some(
    (n) => n.id_usuario === idUsuario && esNovedadSuspension(n) && novedadEnDia(n, fecha)
  )
}

/**
 * Tras una suspensión, la jornada queda en media hasta `restituir_jornada`.
 * No aplica durante los días de la propia suspensión.
 */
export function diaEnMediaJornadaPostSuspension(
  novedades: RrhhNovedad[],
  idUsuario: number,
  fecha: string
): boolean {
  if (diaEnSuspension(novedades, idUsuario, fecha)) return false

  const suspensiones = novedades.filter(
    (n) => n.id_usuario === idUsuario && esNovedadSuspension(n) && n.fecha_hasta < fecha
  )
  if (suspensiones.length === 0) return false

  const ultima = suspensiones.reduce((a, b) => (a.fecha_hasta >= b.fecha_hasta ? a : b))
  const restituida = novedades.some(
    (n) =>
      n.id_usuario === idUsuario &&
      esNovedadRestituirJornada(n) &&
      n.fecha_desde > ultima.fecha_hasta &&
      n.fecha_desde <= fecha
  )
  return !restituida
}
