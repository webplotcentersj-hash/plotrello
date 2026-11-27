/**
 * Regla única para contar los días que corresponde trabajar (asistencia, liquidación, reloj, RRHH):
 * - Lunes a viernes no feriados: 1 día.
 * - Sábado no feriado: ½ día, y sólo para quien trabaja de lunes a sábado.
 * - Domingos y feriados: no cuentan.
 */
import { esFeriado } from './feriadosArgentina'

export const PESO_SABADO = 0.5

/** 0 = domingo … 6 = sábado (fecha YYYY-MM-DD, sin depender de la zona horaria). */
function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Cuánto vale la fecha como día de trabajo para alguien que (no) trabaja sábados. */
export function pesoDiaLaborable(fecha: string, trabajaSabado: boolean | null | undefined): number {
  const dow = diaSemana(fecha)
  if (dow === 0 || esFeriado(fecha)) return 0
  if (dow === 6) return trabajaSabado === true ? PESO_SABADO : 0
  return 1
}

/** Peso de un día ya trabajado/faltado: sábado = ½, el resto = 1. */
export function pesoDia(fecha: string): number {
  return diaSemana(fecha) === 6 ? PESO_SABADO : 1
}

/** Total de días que corresponde trabajar en una lista de fechas. */
export function diasATrabajar(fechas: string[], trabajaSabado: boolean | null | undefined): number {
  return fechas.reduce((s, f) => s + pesoDiaLaborable(f, trabajaSabado), 0)
}

/** Días a trabajar de un mes completo (YYYY-MM). */
export function diasATrabajarMes(periodo: string, trabajaSabado: boolean | null | undefined): number {
  const [y, m] = periodo.split('-').map(Number)
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate()
  let total = 0
  for (let d = 1; d <= ultimo; d++) total += pesoDiaLaborable(`${periodo}-${String(d).padStart(2, '0')}`, trabajaSabado)
  return total
}

/** Redondeo a medio día (evita 20.499999). */
export function redondearMedioDia(n: number): number {
  return Math.round(n * 2) / 2
}

/** "21", "21,5" */
export function fmtDias(n: number): string {
  const r = redondearMedioDia(n)
  return Number.isInteger(r) ? String(r) : r.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
