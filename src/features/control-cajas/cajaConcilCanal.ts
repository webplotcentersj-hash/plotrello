import { esPaseCierreTurno, esTraspasoEntreCajas } from './movimientoCaja'
import type { CajaCierre, CajaMovimiento, PlanillaCajaGuardada } from './types'

export type SistemaDiaFuente = 'cierres' | 'planillas' | 'movimientos' | 'plotlab' | 'ninguno'

export type CruceEstado = 'ok' | 'solo_sistema' | 'solo_extracto'

export type CruceItem = {
  id: string
  monto: number
}

export type CruceLinea = {
  estado: CruceEstado
  sistemaId?: string
  extractoId?: string
  sistemaMonto?: number
  extractoMonto?: number
  diferencia: number
}

const CLASIF_NO_COBRO_MP = new Set([
  'impuesto',
  'retencion',
  'costo',
  'retiro',
  'pago',
  'devolucion',
  'movimiento_interno'
])

export function fechaIsoDia(iso: string): string {
  return (iso || '').slice(0, 10)
}

/** Cobro de cliente en actividad MP (excluye fees, retenciones, retiros). */
export function esCobroExtractoMp(classification: string, importe: number): boolean {
  if (!(importe > 0)) return false
  return !CLASIF_NO_COBRO_MP.has((classification || '').toLowerCase())
}

export function esIngresoExtractoBanco(importe: number): boolean {
  return importe > 0
}

/**
 * Empareja cobros del sistema con líneas del extracto por monto (tolerancia en pesos).
 * Un extracto no se reutiliza.
 */
export function cruzarPorMonto(
  sistema: CruceItem[],
  extracto: CruceItem[],
  tol = 0.51
): CruceLinea[] {
  const used = new Set<string>()
  const out: CruceLinea[] = []
  const ordenados = [...sistema].sort((a, b) => b.monto - a.monto)

  for (const s of ordenados) {
    let best: CruceItem | null = null
    let bestDiff = Infinity
    for (const e of extracto) {
      if (used.has(e.id)) continue
      const d = Math.abs(e.monto - s.monto)
      if (d <= tol && d < bestDiff) {
        best = e
        bestDiff = d
      }
    }
    if (best) {
      used.add(best.id)
      out.push({
        estado: 'ok',
        sistemaId: s.id,
        extractoId: best.id,
        sistemaMonto: s.monto,
        extractoMonto: best.monto,
        diferencia: best.monto - s.monto
      })
    } else {
      out.push({
        estado: 'solo_sistema',
        sistemaId: s.id,
        sistemaMonto: s.monto,
        diferencia: -s.monto
      })
    }
  }

  for (const e of extracto) {
    if (used.has(e.id)) continue
    out.push({
      estado: 'solo_extracto',
      extractoId: e.id,
      extractoMonto: e.monto,
      diferencia: e.monto
    })
  }

  return out
}

function esIngresoOperativo(m: CajaMovimiento): boolean {
  if (m.anulado) return false
  if (m.tipo_movimiento !== 'ingreso') return false
  if (esPaseCierreTurno(m) || esTraspasoEntreCajas(m)) return false
  return true
}

/** Misma regla que `esIngresoMercadoPago`: MP vive en columna tarjeta + marca. */
export function montoMpDeMovimiento(m: CajaMovimiento): number {
  const raw = m.tarjeta || 0
  if (raw <= 0) return 0
  const med = m.medios as Record<string, unknown> | null | undefined
  if (med && typeof med === 'object') {
    const mpCol = Number(med.mercado_pago)
    if (Number.isFinite(mpCol) && mpCol > 0) return mpCol
    if (med.es_mercado_pago === true || med.canal === 'mercado_pago') return raw
  }
  const txt = `${m.observacion || ''} ${m.concepto || ''} ${m.categoria || ''}`.toLowerCase()
  if (/mercado\s*pago|\bmp\s*qr\b|\bmp\/qr\b/.test(txt)) return raw
  return 0
}

function movimientosPlotLabDelDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  pick: (m: CajaMovimiento) => number
): number {
  return movimientos
    .filter(
      (m) =>
        m.fecha === fecha &&
        !m.anulado &&
        m.origen_importacion === 'plotlab_venta' &&
        m.tipo_movimiento === 'ingreso'
    )
    .reduce((s, m) => s + pick(m), 0)
}

function planillaCubreFecha(p: PlanillaCajaGuardada, fecha: string): boolean {
  const d = p.fecha_desde || p.fecha_hasta
  const h = p.fecha_hasta || p.fecha_desde
  if (!d && !h) return false
  if (d && h) return fecha >= d && fecha <= h
  return d === fecha || h === fecha
}

export function sistemaMpParaFecha(
  fecha: string,
  cierres: Pick<CajaCierre, 'fecha' | 'mp_qr'>[],
  _planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): { valor: number; fuente: SistemaDiaFuente } {
  const delMov = movimientos
    .filter((m) => m.fecha === fecha && esIngresoOperativo(m))
    .reduce((s, m) => s + montoMpDeMovimiento(m), 0)
  if (delMov > 0) {
    const delPlotlab = movimientosPlotLabDelDia(movimientos, fecha, montoMpDeMovimiento)
    const fuente: SistemaDiaFuente =
      delPlotlab > 0 && Math.abs(delPlotlab - delMov) <= 0.02 ? 'plotlab' : 'movimientos'
    return { valor: delMov, fuente }
  }

  const delCierreQr = cierres.filter((c) => c.fecha === fecha).reduce((s, c) => s + (c.mp_qr || 0), 0)
  if (delCierreQr > 0) return { valor: delCierreQr, fuente: 'cierres' }

  return { valor: 0, fuente: 'ninguno' }
}

export function sistemaBancoParaFecha(
  fecha: string,
  cierres: Pick<CajaCierre, 'fecha' | 'trans'>[],
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): { valor: number; fuente: SistemaDiaFuente } {
  const delMov = movimientos
    .filter((m) => m.fecha === fecha && esIngresoOperativo(m))
    .reduce((s, m) => s + (m.transferencia_bancaria ?? 0), 0)
  if (delMov > 0) {
    const delPlotlab = movimientosPlotLabDelDia(
      movimientos,
      fecha,
      (m) => m.transferencia_bancaria ?? 0
    )
    const fuente: SistemaDiaFuente =
      delPlotlab > 0 && Math.abs(delPlotlab - delMov) <= 0.02 ? 'plotlab' : 'movimientos'
    return { valor: delMov, fuente }
  }

  const delCierre = cierres.filter((c) => c.fecha === fecha).reduce((s, c) => s + (c.trans || 0), 0)
  if (delCierre > 0) return { valor: delCierre, fuente: 'cierres' }

  const delPlanilla = planillas
    .filter((p) => planillaCubreFecha(p, fecha))
    .reduce((s, p) => s + (Number(p.totales?.ingresos_trans_b) || 0), 0)
  if (delPlanilla > 0) return { valor: delPlanilla, fuente: 'planillas' }

  return { valor: 0, fuente: 'ninguno' }
}
