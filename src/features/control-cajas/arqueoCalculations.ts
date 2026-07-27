import { calcularTotalesCaja } from './movimientoCaja'
import { totalPorClasificacion } from './planillaMediosPago'
import type { CajaMovimiento } from './types'

export type TeoricoFisicoCaja = {
  fondo_fijo: number
  ingresos_fisicos: number
  egresos_fisicos: number
  neto_fisico: number
  teorico: number
}

/**
 * Efectivo físico teórico = ingresos físicos − egresos (sin cta. cte. ni trans. bancaria).
 * El fondo NO se suma: sale del efectivo contado (recorte de lo vendido).
 */
export function calcularTeoricoFisicoCaja(
  movimientos: CajaMovimiento[],
  cajaSlug: string,
  fechaDesde: string,
  fechaHasta: string,
  fondoFijo: number
): TeoricoFisicoCaja {
  const t = calcularTotalesCaja(movimientos, cajaSlug, fechaDesde, fechaHasta)
  const ingresos_fisicos = totalPorClasificacion(t.ingresos).fisico
  const egresos_fisicos = totalPorClasificacion(t.egresos).fisico
  const neto_fisico = ingresos_fisicos - egresos_fisicos
  return {
    fondo_fijo: fondoFijo,
    ingresos_fisicos,
    egresos_fisicos,
    neto_fisico,
    teorico: neto_fisico
  }
}
