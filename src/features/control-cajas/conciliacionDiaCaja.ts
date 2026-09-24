import { planillaEnFecha } from './cajaDashboardData'
import { fondoParaOtraCajaDesdeArqueo, TOLERANCIA_EFECTIVO } from './cierreTurno'
import { esPaseCierreTurno, esTraspasoEntreCajas } from './movimientoCaja'
import type {
  CajaArqueo,
  CajaConcilBanco,
  CajaConcilMP,
  CajaMovimiento,
  CajaRegistro,
  PlanillaCajaGuardada
} from './types'

export type CanalConciliacion =
  | 'efectivo'
  | 'tarjeta'
  | 'mercado_pago'
  | 'transferencia'
  | 'cuenta_corriente'
  | 'otros'

export type EstadoConciliacion = 'ok' | 'revisar' | 'pendiente' | 'sin_mov'

export type MediosDiaTotales = {
  efectivo: number
  tarjeta: number
  mercado_pago: number
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

/** MP devolvió el pago como aprobado (id de pago o marca al sincronizar). */
export function mpPagoConfirmado(
  m: CajaMovimiento,
  ventasMpPagadas?: ReadonlySet<number>
): boolean {
  const med = m.medios as Record<string, unknown> | null | undefined
  if (med && typeof med === 'object') {
    if (med.mp_aprobado === true || med.mp_aprobado === 1) return true
    const pagoId = med.mp_payment_id
    if (typeof pagoId === 'string' && pagoId.trim()) return true
    if (typeof pagoId === 'number' && pagoId > 0) return true
  }
  if (!ventasMpPagadas?.size) return false
  const ref = `${m.observacion || ''} ${m.nro_comprobante || ''}`
  const match = ref.match(/PL-VENTA-(\d+)/i)
  const ventaId = match ? Number(match[1]) : null
  return ventaId != null && ventasMpPagadas.has(ventaId)
}

/** Detecta cobros MP (sigue viviendo en columna tarjeta + marca en obs/medios). */
export function esIngresoMercadoPago(m: CajaMovimiento): boolean {
  const med = m.medios as Record<string, unknown> | null | undefined
  if (med && typeof med === 'object') {
    if (Number(med.mercado_pago) > 0) return true
    if (med.es_mercado_pago === true || med.canal === 'mercado_pago') return true
  }
  const txt = `${m.observacion || ''} ${m.concepto || ''} ${m.categoria || ''}`.toLowerCase()
  return /mercado\s*pago|\bmp\s*qr\b|\bmp\/qr\b/.test(txt)
}

function movimientosPlotLabIngreso(
  movimientos: CajaMovimiento[],
  fecha: string,
  pick: (m: CajaMovimiento) => number
): number {
  return movimientos
    .filter(
      (m) =>
        m.fecha === fecha &&
        !m.anulado &&
        m.tipo_movimiento === 'ingreso' &&
        m.origen_importacion === 'plotlab_venta'
    )
    .reduce((s, m) => s + pick(m), 0)
}

function movimientosPlotLabTarjeta(movimientos: CajaMovimiento[], fecha: string): number {
  return movimientosPlotLabIngreso(movimientos, fecha, (m) =>
    esIngresoMercadoPago(m) ? 0 : m.tarjeta ?? 0
  )
}

function movimientosPlotLabTransferencia(movimientos: CajaMovimiento[], fecha: string): number {
  return movimientosPlotLabIngreso(movimientos, fecha, (m) => m.transferencia_bancaria ?? 0)
}

function movimientosPlotLabEfectivo(movimientos: CajaMovimiento[], fecha: string): number {
  return movimientosPlotLabIngreso(movimientos, fecha, (m) => m.efectivo ?? 0)
}

const LABELS: Record<CanalConciliacion, { label: string; icon: string; esContable: boolean }> = {
  efectivo: { label: 'Efectivo', icon: '💵', esContable: false },
  tarjeta: { label: 'Tarjeta', icon: '💳', esContable: false },
  mercado_pago: { label: 'Mercado Pago', icon: '💙', esContable: false },
  transferencia: { label: 'Transferencia', icon: '🏦', esContable: false },
  cuenta_corriente: { label: 'Cuenta corriente', icon: '📒', esContable: true },
  otros: { label: 'Cheque', icon: '📄', esContable: false }
}

function mediosDesdeMovimiento(
  m: CajaMovimiento,
  ventasMpPagadas?: ReadonlySet<number>
): MediosDiaTotales {
  // Solo cheques: no meter transferencia ni el agregado legacy `otros`.
  const otros = (m.cheque_propio || 0) + (m.cheque_tercero || 0)
  const cc = m.cuenta_corriente || 0
  const efectivo = m.efectivo || 0
  const rawTarjeta = m.tarjeta || 0
  const esMp = rawTarjeta > 0 && esIngresoMercadoPago(m)
  const esVentaPlotlab = m.origen_importacion === 'plotlab_venta'
  const mpOk = esMp && (!esVentaPlotlab || mpPagoConfirmado(m, ventasMpPagadas))
  // Sin confirmación de MP no entra a ningún canal (ni tarjeta ni MP).
  const tarjeta = esMp ? 0 : rawTarjeta
  const mercado_pago = mpOk ? rawTarjeta : 0
  const transferencia = m.transferencia_bancaria || 0
  const totalBruto = m.monto_total ?? efectivo + rawTarjeta + transferencia + cc + otros
  const total = esMp && !mpOk ? Math.max(0, totalBruto - rawTarjeta) : totalBruto
  return {
    efectivo,
    tarjeta,
    mercado_pago,
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
    mercado_pago: a.mercado_pago + b.mercado_pago,
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
  mercado_pago: 0,
  transferencia: 0,
  cuenta_corriente: 0,
  otros: 0,
  total: 0,
  totalCobrado: 0,
  countIngresos: 0
}

/** Ingresos del día (ventas PlotLab, planilla, comprobantes) agrupados por medio. */
export function mediosIngresosDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  ventasMpPagadas?: ReadonlySet<number>
): MediosDiaTotales {
  let acc = MEDIOS_VACIO
  for (const m of movimientos) {
    if (m.fecha !== fecha || m.anulado) continue
    if (m.tipo_movimiento !== 'ingreso') continue
    // Traspasos / pases entre cajas no son cobros.
    if (esPaseCierreTurno(m) || esTraspasoEntreCajas(m)) continue
    const med = mediosDesdeMovimiento(m, ventasMpPagadas)
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
      mercado_pago: 0,
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
  esContable: boolean,
  tol = TOLERANCIA
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
    estado: Math.abs(dif) <= tol ? 'ok' : 'revisar'
  }
}

function totalesArqueoEfectivoDia(arqueos: CajaArqueo[], fecha: string): number {
  return arqueos
    .filter((a) => a.fecha === fecha)
    .reduce((s, a) => s + (Number(a.total) || 0), 0)
}

/** Egresos reales en efectivo del día (ya salieron del cajón antes del arqueo). */
function egresosEfectivoDia(movimientos: CajaMovimiento[], fecha: string): number {
  return movimientos
    .filter(
      (m) =>
        m.fecha === fecha &&
        !m.anulado &&
        m.tipo_movimiento === 'egreso' &&
        !esPaseCierreTurno(m) &&
        !esTraspasoEntreCajas(m)
    )
    .reduce((s, m) => s + (m.efectivo || 0), 0)
}

export type FondoReservaCajaDia = {
  cajaSlug: string
  cajaNombre: string
  /** Quién dejó el fondo (cajero del arqueo). */
  dejadoPor: string
  monto: number
}

/** Fondos dejados en arqueos del día (reserva que queda en caja, no va a admin). */
export function fondosReservaDesdeArqueosDia(
  arqueos: CajaArqueo[],
  fecha: string,
  cajas: Pick<CajaRegistro, 'slug' | 'nombre'>[] = []
): FondoReservaCajaDia[] {
  const nombreCaja = (slug: string | null) => {
    if (!slug) return 'Caja'
    return cajas.find((c) => c.slug === slug)?.nombre || slug
  }
  const byDestino = new Map<string, FondoReservaCajaDia>()
  for (const a of arqueos) {
    if (a.fecha !== fecha) continue
    const fondo = fondoParaOtraCajaDesdeArqueo(a)
    if (!fondo || fondo.monto <= 0) continue
    const dest = fondo.destinoSlug || a.caja_slug
    const s = a.saldos || {}
    const destNombre =
      (typeof s.fondo_destino_nombre === 'string' && s.fondo_destino_nombre.trim()) ||
      nombreCaja(dest)
    const prev = byDestino.get(dest)
    if (prev) {
      prev.monto += fondo.monto
      if (a.usuario_nombre && !prev.dejadoPor.includes(a.usuario_nombre)) {
        prev.dejadoPor = `${prev.dejadoPor}, ${a.usuario_nombre}`
      }
    } else {
      byDestino.set(dest, {
        cajaSlug: dest,
        cajaNombre: destNombre.replace(/^Caja\s+/i, '').trim() || destNombre,
        dejadoPor: a.usuario_nombre?.trim() || nombreCaja(a.caja_slug),
        monto: fondo.monto
      })
    }
  }
  return [...byDestino.values()].sort((a, b) => b.monto - a.monto || a.cajaNombre.localeCompare(b.cajaNombre, 'es'))
}

/** Ids de ventas cuyo cobro Mercado Pago ya tiene id de pago aprobado. */
export function ventasMpPagadasIds(
  ventas: ReadonlyArray<{
    id: number
    mp_payment_id?: string | null
    detalle_pago?: { mp_payment_id?: string | null } | null
  }>
): Set<number> {
  const ids = new Set<number>()
  for (const v of ventas) {
    const pago = String(v.mp_payment_id || v.detalle_pago?.mp_payment_id || '').trim()
    if (pago) ids.add(v.id)
  }
  return ids
}

export function conciliacionAutomaticaDia(input: {
  fecha: string
  movimientos: CajaMovimiento[]
  planillas: PlanillaCajaGuardada[]
  arqueos?: CajaArqueo[]
  concilMp?: CajaConcilMP | null
  concilBanco?: CajaConcilBanco | null
  /** Ventas cuyo pago Mercado Pago ya volvió aprobado. */
  ventasMpPagadas?: ReadonlySet<number>
}): LineaConciliacionDia[] {
  const { fecha, movimientos, planillas, arqueos = [], concilMp, concilBanco, ventasMpPagadas } = input
  const mov = mediosIngresosDia(movimientos, fecha, ventasMpPagadas)
  const planilla = totalesPlanillaDia(planillas, fecha)
  const comprobantes = totalesComprobantesDia(movimientos, fecha)

  // Contado = ventas ef − egresos ef → para comparar con ventas se suman los egresos pagados.
  const efArqueoContado = totalesArqueoEfectivoDia(arqueos, fecha)
  const efArqueo = efArqueoContado > 0 ? efArqueoContado + egresosEfectivoDia(movimientos, fecha) : 0
  const efPlotlab = movimientosPlotLabEfectivo(movimientos, fecha)
  const refEfectivo =
    efArqueo > 0
      ? efArqueo
      : planilla != null && planilla.efectivo > 0
        ? planilla.efectivo
        : efPlotlab > 0
          ? efPlotlab
          : null
  const refEfectivoFuente =
    efArqueo > 0
      ? 'Arqueo + egresos pagados'
      : planilla != null && planilla.efectivo > 0
        ? 'Planilla PDF'
        : efPlotlab > 0
          ? 'Ventas PlotLab'
          : null

  const dashboardMp = concilMp && (concilMp.dashboard ?? 0) > 0 ? (concilMp.dashboard ?? 0) : 0
  const refMp =
    dashboardMp > 0 ? dashboardMp : comprobantes.mercado_pago > 0 ? comprobantes.mercado_pago : null

  const refMpFuente =
    dashboardMp > 0
      ? 'Dashboard Mercado Pago'
      : comprobantes.mercado_pago > 0
        ? 'Comprobantes MP'
        : null

  const tjPlotlab = movimientosPlotLabTarjeta(movimientos, fecha)
  const refTarjeta =
    comprobantes.tarjeta > 0
      ? comprobantes.tarjeta
      : planilla?.tarjeta != null && planilla.tarjeta > 0
        ? planilla.tarjeta
        : tjPlotlab > 0
          ? tjPlotlab
          : null

  const refTarjetaFuente =
    comprobantes.tarjeta > 0
      ? 'Comprobantes POS'
      : planilla?.tarjeta
        ? 'Planilla PDF'
        : tjPlotlab > 0
          ? 'Ventas PlotLab'
          : null

  const refTrans =
    concilBanco != null
      ? (concilBanco.sistema ?? concilBanco.extracto ?? null)
      : planilla?.transferencia != null && planilla.transferencia > 0
        ? planilla.transferencia
        : movimientosPlotLabTransferencia(movimientos, fecha) || null

  const refTransFuente = concilBanco
    ? 'Conciliación bancaria'
    : planilla?.transferencia
      ? 'Planilla PDF'
      : movimientosPlotLabTransferencia(movimientos, fecha) > 0
        ? 'Ventas PlotLab'
        : null

  const canales: CanalConciliacion[] = [
    'efectivo',
    'tarjeta',
    'mercado_pago',
    'transferencia',
    'cuenta_corriente',
    'otros'
  ]

  const valoresMov: Record<CanalConciliacion, number> = {
    efectivo: mov.efectivo,
    tarjeta: mov.tarjeta,
    mercado_pago: mov.mercado_pago,
    transferencia: mov.transferencia,
    cuenta_corriente: mov.cuenta_corriente,
    otros: mov.otros
  }

  const refs: Record<CanalConciliacion, { valor: number | null; fuente: string | null }> = {
    efectivo: { valor: refEfectivo, fuente: refEfectivoFuente },
    tarjeta: { valor: refTarjeta, fuente: refTarjetaFuente },
    mercado_pago: { valor: refMp, fuente: refMpFuente },
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
      meta.esContable,
      canal === 'efectivo' ? TOLERANCIA_EFECTIVO : TOLERANCIA
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
