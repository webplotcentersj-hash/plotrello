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
 * Parte de un pago del mes que excedió el neto y se usó para bajar una deuda.
 * Se guarda en `config_json.aplicacionesDeuda` del período para no contarla dos veces
 * (ya restó del pendiente de la deuda) y poder revertirla si se borra el pago.
 */
export type AplicacionDeuda = {
  idUsuario: number
  idDeuda: number
  idPago: number
  monto: number
}

export function normalizarAplicaciones(raw: unknown): AplicacionDeuda[] {
  if (!Array.isArray(raw)) return []
  const out: AplicacionDeuda[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const a = r as Partial<AplicacionDeuda>
    const monto = round2(Number(a.monto) || 0)
    if (!(monto > 0) || !a.idUsuario || !a.idDeuda || !a.idPago) continue
    out.push({ idUsuario: Number(a.idUsuario), idDeuda: Number(a.idDeuda), idPago: Number(a.idPago), monto })
  }
  return out
}

export function totalAplicadoADeudas(aplicaciones: AplicacionDeuda[], idUsuario: number): number {
  return round2(aplicaciones.filter((a) => a.idUsuario === idUsuario).reduce((s, a) => s + a.monto, 0))
}

/**
 * Neto del mes + deudas pendientes − lo pagado que fue al neto.
 * Lo que se aplicó a deudas ya bajó su pendiente, así que no se resta de nuevo.
 * El saldo > 0 es lo que aún se le debe; < 0, lo pagado de más.
 */
export function resumenLiquidacionDeuda(params: {
  netoMes: number
  deudas: RrhhLiquidacionDeuda[]
  pagos: RrhhLiquidacionPago[]
  aplicadoADeudas?: number
}): {
  netoMes: number
  deudas: number
  totalALiquidar: number
  pagado: number
  aplicadoADeudas: number
  saldo: number
} {
  const netoMes = round2(Math.max(0, params.netoMes))
  const deudas = totalDeudasPendientes(params.deudas)
  const totalALiquidar = round2(netoMes + deudas)
  const pagado = totalPagos(params.pagos)
  const aplicadoADeudas = round2(Math.max(0, params.aplicadoADeudas ?? 0))
  const saldo = round2(totalALiquidar - (pagado - aplicadoADeudas))
  return { netoMes, deudas, totalALiquidar, pagado, aplicadoADeudas, saldo }
}

/**
 * Excedente del neto todavía no aplicado a deudas: lo pagado por encima del neto
 * menos lo que ya se usó para bajar deudas. Así un pago nuevo solo aplica su parte.
 */
export function excedenteSinAplicar(params: {
  netoMes: number
  pagado: number
  aplicadoADeudas: number
}): number {
  const neto = Math.max(0, params.netoMes)
  return round2(Math.max(0, params.pagado - neto - Math.max(0, params.aplicadoADeudas)))
}

/** Reparte un monto entre deudas por orden de alta (FIFO). */
export function repartirFifo(
  deudas: RrhhLiquidacionDeuda[],
  monto: number
): { deuda: RrhhLiquidacionDeuda; aplica: number }[] {
  let resto = round2(monto)
  const out: { deuda: RrhhLiquidacionDeuda; aplica: number }[] = []
  for (const d of deudas.slice().sort((a, b) => a.id - b.id)) {
    if (resto <= 0) break
    const aplica = round2(Math.min(d.monto_pendiente, resto))
    if (aplica <= 0) continue
    out.push({ deuda: d, aplica })
    resto = round2(resto - aplica)
  }
  return out
}

/**
 * Saldo impago de un mes que pasa al siguiente como arrastre:
 * neto − (pagos − aplicado a deudas) + lo que quedó pendiente del arrastre anterior.
 * Las deudas manuales (mes anterior / especial) no entran: siguen vivas por sí solas.
 */
export function saldoParaArrastre(params: {
  netoMes: number
  pagado: number
  aplicadoADeudas: number
  arrastreAnteriorPendiente: number
}): number {
  const neto = Math.max(0, params.netoMes)
  const alNeto = params.pagado - Math.max(0, params.aplicadoADeudas)
  return round2(neto - alNeto + Math.max(0, params.arrastreAnteriorPendiente))
}

/** Desde el mes actual en adelante se genera arrastre automático del saldo impago. */
export function periodoHabilitaArrastreAuto(periodo: string, hoyIso = new Date().toISOString()): boolean {
  const hoyMes = hoyIso.slice(0, 7)
  return periodo >= hoyMes
}

export function periodoOrigenArrastre(periodoActual: string): string {
  return mesAnterior(periodoActual)
}
