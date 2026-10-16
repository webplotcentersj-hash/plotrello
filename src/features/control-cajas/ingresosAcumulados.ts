import { montoVisibleMovimiento } from './format'
import { esPaseCierreTurno, esTraspasoEntreCajas } from './movimientoCaja'
import type { CajaMovimiento, PlanillaCajaGuardada } from './types'

/** Lunes (ISO) de la semana de `fecha` (YYYY-MM-DD). */
export function lunesDeSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  dt.setUTCDate(dt.getUTCDate() - offset)
  return dt.toISOString().slice(0, 10)
}

export function inicioMes(fecha: string): string {
  return /^\d{4}-\d{2}/.test(fecha) ? `${fecha.slice(0, 7)}-01` : fecha
}

export function inicioAnio(fecha: string): string {
  return /^\d{4}/.test(fecha) ? `${fecha.slice(0, 4)}-01-01` : fecha
}

export type IngresosAcumulados = {
  semana: number
  mes: number
  anio: number
  desdeSemana: string
  desdeMes: string
  desdeAnio: string
  hasta: string
}

function esIngresoCobrado(m: CajaMovimiento): boolean {
  if (m.anulado) return false
  if (m.tipo_movimiento !== 'ingreso') return false
  if (esPaseCierreTurno(m) || esTraspasoEntreCajas(m)) return false
  return true
}

function fechasEnRangoPlanilla(p: Pick<PlanillaCajaGuardada, 'fecha_desde' | 'fecha_hasta'>): string[] {
  const d = (p.fecha_desde || p.fecha_hasta || '').slice(0, 10)
  const h = (p.fecha_hasta || p.fecha_desde || d).slice(0, 10)
  if (!d) return []
  if (d === h) return [d]
  const out: string[] = []
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day))
  while (true) {
    const key = dt.toISOString().slice(0, 10)
    if (key > h) break
    out.push(key)
    dt.setUTCDate(dt.getUTCDate() + 1)
  }
  return out
}

function totalesIngresosPlanilla(p: PlanillaCajaGuardada): number {
  return Number(p.totales?.ingresos_total) || 0
}

function ingresosPorFechaRango(
  movimientos: CajaMovimiento[],
  desde: string,
  hasta: string
): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of movimientos) {
    if (!m.fecha || m.fecha < desde || m.fecha > hasta) continue
    if (!esIngresoCobrado(m)) continue
    const monto = montoVisibleMovimiento(m)
    if (monto <= 0) continue
    map.set(m.fecha, (map.get(m.fecha) || 0) + monto)
  }
  return map
}

function sumarIngresosRango(
  desde: string,
  hasta: string,
  planillas: PlanillaCajaGuardada[],
  porFecha: Map<string, number>
): number {
  let total = 0
  const diasConMov = new Set<string>()
  for (const [fecha, monto] of porFecha) {
    if (fecha < desde || fecha > hasta) continue
    if (monto <= 0) continue
    total += monto
    diasConMov.add(fecha)
  }
  for (const p of planillas) {
    const fechas = fechasEnRangoPlanilla(p).filter((f) => f >= desde && f <= hasta)
    if (!fechas.length) continue
    if (fechas.some((f) => diasConMov.has(f))) continue
    total += totalesIngresosPlanilla(p)
  }
  return total
}

/**
 * Ingresos cobrados acumulados hasta `hasta` (semana lun–día, mes y año).
 * Sin pases ni traspasos entre cajas. El resto de cierre de turno no entra:
 * el acumulado es venta/cobro, no lo que quedó en administración.
 */
export function ingresosAcumuladosHasta(
  hasta: string,
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): IngresosAcumulados {
  const desdeSemana = lunesDeSemana(hasta)
  const desdeMes = inicioMes(hasta)
  const desdeAnio = inicioAnio(hasta)
  const porFecha = ingresosPorFechaRango(movimientos, desdeAnio, hasta)
  return {
    semana: sumarIngresosRango(desdeSemana, hasta, planillas, porFecha),
    mes: sumarIngresosRango(desdeMes, hasta, planillas, porFecha),
    anio: sumarIngresosRango(desdeAnio, hasta, planillas, porFecha),
    desdeSemana,
    desdeMes,
    desdeAnio,
    hasta
  }
}
