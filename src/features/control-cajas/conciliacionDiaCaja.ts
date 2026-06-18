import { planillaEnFecha } from './cajaDashboardData'
import type {
  CajaConcilBanco,
  CajaConcilMP,
  CajaMovimiento,
  PlanillaCajaGuardada
} from './types'

export type CanalConciliacion =
  | 'efectivo'
  | 'tarjeta'
  | 'transferencia'
  | 'cuenta_corriente'
  | 'otros'

export type EstadoConciliacion = 'ok' | 'revisar' | 'pendiente' | 'sin_mov'

export type MediosDiaTotales = {
  efectivo: number
  tarjeta: number
  transferencia: number
  cuenta_corriente: number
  otros: number
  total: number
  totalCobrado: number
  countIngresos: number
}

export type LineaConciliacionDia = {
  canal: CanalConciliacion
  label: string
  icon: string
  movimientos: number
  referencia: number | null
  referenciaFuente: string | null
  diferencia: number
  estado: EstadoConciliacion
  /** CC y similares no entran al arqueo físico. */
  esContable: boolean
}

const TOLERANCIA = 0.02

const LABELS: Record<CanalConciliacion, { label: string; icon: string; esContable: boolean }> = {
  efectivo: { label: 'Efectivo', icon: '💵', esContable: false },
  tarjeta: { label: 'Tarjetas / MP', icon: '💳', esContable: false },
  transferencia: { label: 'Transferencia', icon: '🏦', esContable: false },
  cuenta_corriente: { label: 'Cuenta corriente', icon: '📒', esContable: true },
  otros: { label: 'Cheques / otros', icon: '📄', esContable: false }
}

function mediosDesdeMovimiento(m: CajaMovimiento): MediosDiaTotales {
  const otros =
    (m.cheque_propio || 0) +
    (m.cheque_tercero || 0) +
    (m.documento || 0) +
    (m.cuenta_contable || 0) +
    (m.otros || 0)
  const cc = m.cuenta_corriente || 0
  const efectivo = m.efectivo || 0
  const tarjeta = m.tarjeta || 0
  const transferencia = m.transferencia_bancaria || 0
  const total = m.monto_total ?? efectivo + tarjeta + transferencia + cc + otros
  return {
    efectivo,
    tarjeta,
    transferencia,
    cuenta_corriente: cc,
    otros,
    total,
    totalCobrado: total - cc,
    countIngresos: 0
  }
}

function sumarMedios(a: MediosDiaTotales, b: MediosDiaTotales): MediosDiaTotales {
  return {
    efectivo: a.efectivo + b.efectivo,
    tarjeta: a.tarjeta + b.tarjeta,
    transferencia: a.transferencia + b.transferencia,
    cuenta_corriente: a.cuenta_corriente + b.cuenta_corriente,
    otros: a.otros + b.otros,
    total: a.total + b.total,
    totalCobrado: a.totalCobrado + b.totalCobrado,
    countIngresos: a.countIngresos + b.countIngresos
  }
}

const MEDIOS_VACIO: MediosDiaTotales = {
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  cuenta_corriente: 0,
  otros: 0,
  total: 0,
  totalCobrado: 0,
  countIngresos: 0
}

/** Ingresos del día (ventas PlotLab, planilla, comprobantes) agrupados por medio. */
export function mediosIngresosDia(movimientos: CajaMovimiento[], fecha: string): MediosDiaTotales {
  let acc = MEDIOS_VACIO
  for (const m of movimientos) {
    if (m.fecha !== fecha || m.anulado) continue
    if (m.tipo_movimiento !== 'ingreso') continue
    const med = mediosDesdeMovimiento(m)
    acc = sumarMedios(acc, { ...med, countIngresos: 1 })
  }
  return acc
}

function totalesPlanillaDia(planillas: PlanillaCajaGuardada[], fecha: string): MediosDiaTotales | null {
  const delDia = planillas.filter((p) => planillaEnFecha(p, fecha))
  if (!delDia.length) return null
  let acc = MEDIOS_VACIO
  for (const p of delDia) {
    const t = p.totales ?? {}
    const ef = Number(t.ingresos_efectivo) || 0
    const tj = Number(t.ingresos_tarjetas) || 0
    const tr = Number(t.ingresos_trans_b) || 0
    const cc = Number(t.ingresos_cta_cte) || 0
    const tot = Number(t.ingresos_total) || ef + tj + tr + cc
    acc = sumarMedios(acc, {
      efectivo: ef,
      tarjeta: tj,
      transferencia: tr,
      cuenta_corriente: cc,
      otros: 0,
      total: tot,
      totalCobrado: tot - cc,
      countIngresos: 0
    })
  }
  return acc
}

function totalesComprobantesDia(movimientos: CajaMovimiento[], fecha: string): MediosDiaTotales {
  let acc = MEDIOS_VACIO
  for (const m of movimientos) {
    if (m.fecha !== fecha || m.anulado) continue
    if (m.origen_importacion !== 'comprobante') continue
    acc = sumarMedios(acc, mediosDesdeMovimiento(m))
  }
  return acc
}

function estadoLinea(
  mov: number,
  ref: number | null,
  fuente: string | null,
  esContable: boolean
): Pick<LineaConciliacionDia, 'referencia' | 'referenciaFuente' | 'diferencia' | 'estado'> {
  if (mov <= TOLERANCIA && (!ref || ref <= TOLERANCIA)) {
    return { referencia: ref, referenciaFuente: fuente, diferencia: 0, estado: 'sin_mov' }
  }
  if (esContable) {
    return {
      referencia: mov,
      referenciaFuente: 'Registro contable (no arqueo)',
      diferencia: 0,
      estado: mov > TOLERANCIA ? 'ok' : 'sin_mov'
    }
  }
  if (ref == null || ref <= TOLERANCIA) {
    return {
      referencia: null,
      referenciaFuente: null,
      diferencia: 0,
      estado: mov > TOLERANCIA ? 'pendiente' : 'sin_mov'
    }
  }
  const dif = mov - ref
  return {
    referencia: ref,
    referenciaFuente: fuente,
    diferencia: dif,
    estado: Math.abs(dif) <= TOLERANCIA ? 'ok' : 'revisar'
  }
}

export function conciliacionAutomaticaDia(input: {
  fecha: string
  movimientos: CajaMovimiento[]
  planillas: PlanillaCajaGuardada[]
  concilMp?: CajaConcilMP | null
  concilBanco?: CajaConcilBanco | null
}): LineaConciliacionDia[] {
  const { fecha, movimientos, planillas, concilMp, concilBanco } = input
  const mov = mediosIngresosDia(movimientos, fecha)
  const planilla = totalesPlanillaDia(planillas, fecha)
  const comprobantes = totalesComprobantesDia(movimientos, fecha)

  const refEfectivo = planilla?.efectivo ?? null
  const refEfectivoFuente = planilla ? 'Planilla PDF' : null

  const refTarjetaMp =
    concilMp != null
      ? (concilMp.sistema ?? 0) > 0 || (concilMp.dashboard ?? 0) > 0
        ? concilMp.sistema ?? concilMp.dashboard ?? 0
        : null
      : comprobantes.tarjeta > 0
        ? comprobantes.tarjeta
        : planilla?.tarjeta ?? null

  const refTarjetaFuente = concilMp
    ? 'Conciliación MP'
    : comprobantes.tarjeta > 0
      ? 'Comprobantes MP/POS'
      : planilla
        ? 'Planilla PDF'
        : null

  const refTrans =
    concilBanco != null
      ? (concilBanco.sistema ?? concilBanco.extracto ?? null)
      : planilla?.transferencia ?? null

  const refTransFuente = concilBanco ? 'Conciliación bancaria' : planilla ? 'Planilla PDF' : null

  const canales: CanalConciliacion[] = [
    'efectivo',
    'tarjeta',
    'transferencia',
    'cuenta_corriente',
    'otros'
  ]

  const valoresMov: Record<CanalConciliacion, number> = {
    efectivo: mov.efectivo,
    tarjeta: mov.tarjeta,
    transferencia: mov.transferencia,
    cuenta_corriente: mov.cuenta_corriente,
    otros: mov.otros
  }

  const refs: Record<
    CanalConciliacion,
    { valor: number | null; fuente: string | null }
  > = {
    efectivo: { valor: refEfectivo, fuente: refEfectivoFuente },
    tarjeta: { valor: refTarjetaMp, fuente: refTarjetaFuente },
    transferencia: { valor: refTrans, fuente: refTransFuente },
    cuenta_corriente: {
      valor: planilla?.cuenta_corriente ?? mov.cuenta_corriente,
      fuente: 'Ventas a cuenta corriente'
    },
    otros: { valor: planilla?.otros ?? null, fuente: planilla ? 'Planilla PDF' : null }
  }

  return canales.map((canal) => {
    const meta = LABELS[canal]
    const st = estadoLinea(
      valoresMov[canal],
      refs[canal].valor,
      refs[canal].fuente,
      meta.esContable
    )
    return {
      canal,
      label: meta.label,
      icon: meta.icon,
      movimientos: valoresMov[canal],
      esContable: meta.esContable,
      ...st
    }
  })
}

export function movimientosDelDia(
  movimientos: CajaMovimiento[],
  fecha: string
): CajaMovimiento[] {
  return movimientos
    .filter((m) => m.fecha === fecha && !m.anulado)
    .sort((a, b) => {
      const ha = a.hora || ''
      const hb = b.hora || ''
      if (ha && hb && ha !== hb) return hb.localeCompare(ha)
      const ca = a.created_at || ''
      const cb = b.created_at || ''
      return cb.localeCompare(ca)
    })
}

export function labelEstadoConciliacion(estado: EstadoConciliacion): string {
  switch (estado) {
    case 'ok':
      return 'Conciliado'
    case 'revisar':
      return 'Revisar'
    case 'pendiente':
      return 'Pendiente'
    default:
      return '—'
  }
}
