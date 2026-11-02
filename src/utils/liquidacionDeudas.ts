import type { RrhhLiquidacionDeuda, RrhhLiquidacionPago } from '../types/api'
import { mesAnterior } from './liquidacionMensual'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function etiquetaDeudaTipo(tipo: RrhhLiquidacionDeuda['tipo']): string {
  if (tipo === 'mes_anterior') return 'Mes anterior'
  if (tipo === 'especial') return 'Especial'
  return 'Arrastre'
}

/** Deudas que suman al total a liquidar del período (activas con pendiente). */
export function deudasAplicables(
  deudas: RrhhLiquidacionDeuda[],
  idUsuario: number,
  periodo: string
): RrhhLiquidacionDeuda[] {
  return deudas.filter((d) => {
    if (!d.activa || d.id_usuario !== idUsuario || d.monto_pendiente <= 0) return false
    // Arrastre solo del período actual; manuales (mes_anterior/especial) mientras tengan pendiente.
    if (d.tipo === 'arrastre') return d.periodo_destino === periodo
    return true
  })
}

export function totalDeudasPendientes(deudas: RrhhLiquidacionDeuda[]): number {
  return round2(deudas.reduce((s, d) => s + (Number(d.monto_pendiente) || 0), 0))
}

export function totalPagos(pagos: RrhhLiquidacionPago[]): number {
  return round2(pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0))
}

/**
 * Neto del mes + deudas pendientes − pagos del mes.
 * El saldo > 0 es lo que aún se le debe (arrastrable al mes siguiente).
 */
export function resumenLiquidacionDeuda(params: {
  netoMes: number
  deudas: RrhhLiquidacionDeuda[]
  pagos: RrhhLiquidacionPago[]
}): {
  netoMes: number
  deudas: number
  totalALiquidar: number
  pagado: number
  saldo: number
} {
  const netoMes = round2(Math.max(0, params.netoMes))
  const deudas = totalDeudasPendientes(params.deudas)
  const totalALiquidar = round2(netoMes + deudas)
  const pagado = totalPagos(params.pagos)
  const saldo = round2(totalALiquidar - pagado)
  return { netoMes, deudas, totalALiquidar, pagado, saldo }
}

/** Desde el mes actual en adelante se genera arrastre automático del saldo impago. */
export function periodoHabilitaArrastreAuto(periodo: string, hoyIso = new Date().toISOString()): boolean {
  const hoyMes = hoyIso.slice(0, 7)
  return periodo >= hoyMes
}

export function periodoOrigenArrastre(periodoActual: string): string {
  return mesAnterior(periodoActual)
}
