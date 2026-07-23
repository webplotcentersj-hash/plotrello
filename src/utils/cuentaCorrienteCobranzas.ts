import type {
  CcCobranzaAgingBucket,
  CcCobranzaClienteResumen,
  CcCobranzaVentaItem,
  CcCobranzaVendedorResumen,
  CcVentaResumen,
  Venta
} from '../types/api'

const MS_DAY = 86400000

export function esVentaCuentaCorriente(metodo?: string | null): boolean {
  return !!metodo && /cuenta\s*corriente/i.test(metodo)
}

export function fechaVencimientoVentaCc(fechaVenta: string): string {
  const base = new Date(fechaVenta.includes('T') ? fechaVenta : `${fechaVenta}T12:00:00`)
  if (Number.isNaN(base.getTime())) return fechaVenta.slice(0, 10)
  base.setDate(base.getDate() + 30)
  return base.toISOString().slice(0, 10)
}

export function bucketAging(diasVencido: number): CcCobranzaAgingBucket {
  if (diasVencido <= 0) return 'al_dia'
  if (diasVencido <= 30) return '1_30'
  if (diasVencido <= 60) return '31_60'
  if (diasVencido <= 90) return '61_90'
  return '90_mas'
}

export const CC_AGING_LABELS: Record<CcCobranzaAgingBucket, string> = {
  al_dia: 'Al día',
  '1_30': '1–30 días',
  '31_60': '31–60 días',
  '61_90': '61–90 días',
  '90_mas': '+90 días'
}

export function ventasCcAbiertasDesdeVentas(ventas: Venta[]): CcCobranzaVentaItem[] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return ventas
    .filter(
      (v) =>
        esVentaCuentaCorriente(v.metodo_pago) &&
        v.id_cliente &&
        (v.estado_pago === 'Pendiente' || v.estado_pago === 'Parcial')
    )
    .map((v) => {
      const total = Number(v.valor_total) || 0
      const pagado = Number(v.monto_pagado) || 0
      const pendiente = Math.max(0, total - pagado)
      const fv = fechaVencimientoVentaCc(v.fecha_venta)
      const venc = new Date(`${fv}T12:00:00`)
      const diasVencido = Math.floor((hoy.getTime() - venc.getTime()) / MS_DAY)
      return {
        id_venta: v.id,
        numero_venta: v.numero_venta || String(v.id),
        id_cliente: v.id_cliente!,
        cliente_nombre: v.cliente_empresa || v.cliente_nombre || `Cliente #${v.id_cliente}`,
        valor_total: total,
        monto_pendiente: pendiente,
        estado_pago: v.estado_pago,
        fecha_venta: v.fecha_venta?.slice(0, 10) ?? '',
        fecha_vencimiento: fv,
        dias_vencido: diasVencido,
        bucket: bucketAging(diasVencido),
        id_vendedor: v.id_vendedor ?? null,
        nombre_vendedor: v.nombre_vendedor?.trim() || 'Sin vendedor'
      }
    })
    .filter((v) => v.monto_pendiente > 0.009)
    .sort((a, b) => b.dias_vencido - a.dias_vencido || b.monto_pendiente - a.monto_pendiente)
}

/** Movimiento mínimo del ledger para reconciliar cobranzas. */
export type CcMovLedgerCobranza = {
  id_cliente: number
  id_venta: number | null
  tipo: string
  debe: number
  haber: number
}

/**
 * Ajusta ventas “abiertas” con pagos del ledger CC.
 * 1) Descuenta pagos imputados a cada venta.
 * 2) Imputa pagos sin venta (FIFO por fecha) al restante.
 * Así el KPI no cuenta deuda ya cobrada en cuenta corriente.
 */
export function reconciliarVentasCcConLedger(
  items: CcCobranzaVentaItem[],
  movimientos: CcMovLedgerCobranza[]
): CcCobranzaVentaItem[] {
  if (!items.length) return []

  const pendiente = new Map<number, number>()
  for (const it of items) pendiente.set(it.id_venta, it.monto_pendiente)

  const librePorCliente = new Map<number, number>()

  for (const m of movimientos) {
    const haber = Number(m.haber) || 0
    if (haber <= 0.009) continue
    const tipo = (m.tipo || '').toLowerCase()
    if (tipo !== 'pago' && tipo !== 'nota_credito' && tipo !== 'nc') continue

    if (m.id_venta != null && pendiente.has(m.id_venta)) {
      const rest = Math.max(0, (pendiente.get(m.id_venta) || 0) - haber)
      pendiente.set(m.id_venta, rest)
    } else if (m.id_venta == null) {
      librePorCliente.set(m.id_cliente, (librePorCliente.get(m.id_cliente) || 0) + haber)
    }
  }

  const porCliente = new Map<number, CcCobranzaVentaItem[]>()
  for (const it of items) {
    const list = porCliente.get(it.id_cliente) ?? []
    list.push(it)
    porCliente.set(it.id_cliente, list)
  }

  for (const [idCliente, ventas] of porCliente) {
    let libre = librePorCliente.get(idCliente) || 0
    if (libre <= 0.009) continue
    const orden = [...ventas].sort((a, b) =>
      a.fecha_venta.localeCompare(b.fecha_venta) || a.id_venta - b.id_venta
    )
    for (const v of orden) {
      if (libre <= 0.009) break
      const rest = pendiente.get(v.id_venta) || 0
      if (rest <= 0.009) continue
      const aplica = Math.min(rest, libre)
      pendiente.set(v.id_venta, rest - aplica)
      libre -= aplica
    }
  }

  return items
    .map((it) => ({
      ...it,
      monto_pendiente: Math.max(0, pendiente.get(it.id_venta) || 0)
    }))
    .filter((it) => it.monto_pendiente > 0.009)
    .sort((a, b) => b.dias_vencido - a.dias_vencido || b.monto_pendiente - a.monto_pendiente)
}

export function resumenPorVendedor(items: CcCobranzaVentaItem[]): CcCobranzaVendedorResumen[] {
  const map = new Map<string, CcCobranzaVendedorResumen>()
  for (const it of items) {
    const key = it.id_vendedor != null ? String(it.id_vendedor) : `n:${it.nombre_vendedor}`
    const prev = map.get(key) ?? {
      id_vendedor: it.id_vendedor,
      nombre_vendedor: it.nombre_vendedor,
      ventas_count: 0,
      monto_pendiente: 0,
      ventas_pendientes: 0
    }
    prev.ventas_count += 1
    prev.monto_pendiente += it.monto_pendiente
    prev.ventas_pendientes += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => b.monto_pendiente - a.monto_pendiente)
}

export function agingDesdeItems(items: CcCobranzaVentaItem[]) {
  const aging: Record<CcCobranzaAgingBucket, { count: number; monto: number }> = {
    al_dia: { count: 0, monto: 0 },
    '1_30': { count: 0, monto: 0 },
    '31_60': { count: 0, monto: 0 },
    '61_90': { count: 0, monto: 0 },
    '90_mas': { count: 0, monto: 0 }
  }
  for (const it of items) {
    aging[it.bucket].count += 1
    aging[it.bucket].monto += it.monto_pendiente
  }
  return aging
}

export function resumenPorCliente(items: CcCobranzaVentaItem[]): CcCobranzaClienteResumen[] {
  const map = new Map<number, CcCobranzaClienteResumen>()
  for (const it of items) {
    const prev = map.get(it.id_cliente) ?? {
      id_cliente: it.id_cliente,
      cliente_nombre: it.cliente_nombre,
      ventas_abiertas: 0,
      monto_pendiente: 0,
      peor_dias_vencido: 0
    }
    prev.ventas_abiertas += 1
    prev.monto_pendiente += it.monto_pendiente
    prev.peor_dias_vencido = Math.max(prev.peor_dias_vencido, it.dias_vencido)
    map.set(it.id_cliente, prev)
  }
  return [...map.values()].sort((a, b) => b.monto_pendiente - a.monto_pendiente)
}

export function estadoCobroVenta(diasVencido: number): { label: string; cls: string } {
  if (diasVencido > 0) return { label: 'Vencido', cls: 'cc-cob--vencido' }
  if (diasVencido >= -7) return { label: 'Por vencer', cls: 'cc-cob--proximo' }
  return { label: 'Al día', cls: 'cc-cob--ok' }
}

export type CcAlertaVencimientoResumen = {
  vencidas: { count: number; monto: number; items: CcCobranzaVentaItem[] }
  porVencer: { count: number; monto: number; items: CcCobranzaVentaItem[] }
  totalAlertas: number
}

/** Ventas abiertas vencidas o dentro de los próximos `diasAviso` (default 7). */
export function resumenAlertasVencimientoCc(
  items: Array<
    Pick<CcCobranzaVentaItem, 'dias_vencido' | 'monto_pendiente'> & Partial<CcCobranzaVentaItem>
  >,
  diasAviso = 7
): CcAlertaVencimientoResumen {
  const vencidasItems: CcCobranzaVentaItem[] = []
  const porVencerItems: CcCobranzaVentaItem[] = []
  let montoVencido = 0
  let montoPorVencer = 0

  for (const it of items) {
    const dias = Number(it.dias_vencido) || 0
    const monto = Number(it.monto_pendiente) || 0
    if (monto <= 0.009) continue
    if (dias > 0) {
      vencidasItems.push(it as CcCobranzaVentaItem)
      montoVencido += monto
    } else if (dias >= -diasAviso) {
      porVencerItems.push(it as CcCobranzaVentaItem)
      montoPorVencer += monto
    }
  }

  return {
    vencidas: { count: vencidasItems.length, monto: montoVencido, items: vencidasItems },
    porVencer: { count: porVencerItems.length, monto: montoPorVencer, items: porVencerItems },
    totalAlertas: vencidasItems.length + porVencerItems.length
  }
}

type VentaDetalleCobranza = Pick<
  Venta,
  'id' | 'id_vendedor' | 'nombre_vendedor' | 'monto_pagado' | 'estado_pago' | 'fecha_venta' | 'valor_total'
>

export function enriquecerVentaResumen(
  venta: CcVentaResumen,
  detalle?: VentaDetalleCobranza | null
): CcVentaResumen {
  const total = Number(detalle?.valor_total ?? venta.valor_total) || 0
  const pagadoRaw = Number(detalle?.monto_pagado ?? venta.monto_pagado) || 0
  const estadoRaw = detalle?.estado_pago ?? venta.estado_pago

  let montoPendiente = 0
  if (estadoRaw !== 'Pagado' && estadoRaw !== 'Cancelado') {
    montoPendiente = Math.max(0, total - pagadoRaw)
  }

  let estadoPago = estadoRaw || 'Pendiente'
  let montoPagado = pagadoRaw
  if (estadoPago === 'Cancelado') {
    montoPendiente = 0
  } else if (total > 0 && montoPendiente <= 0.009) {
    estadoPago = 'Pagado'
    montoPagado = total
    montoPendiente = 0
  } else if (montoPagado > 0.009 && montoPendiente > 0.009) {
    estadoPago = 'Parcial'
  }

  const fv = fechaVencimientoVentaCc(detalle?.fecha_venta ?? venta.fecha_venta)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(`${fv}T12:00:00`)
  const diasVencido = Math.floor((hoy.getTime() - venc.getTime()) / MS_DAY)

  return {
    ...venta,
    valor_total: total,
    id_vendedor: detalle?.id_vendedor ?? venta.id_vendedor ?? null,
    nombre_vendedor: detalle?.nombre_vendedor?.trim() || venta.nombre_vendedor?.trim() || 'Sin vendedor',
    estado_pago: estadoPago,
    monto_pagado: montoPagado,
    monto_pendiente: montoPendiente,
    fecha_vencimiento: fv,
    dias_vencido: diasVencido,
    bucket: bucketAging(diasVencido)
  }
}

export function enriquecerVentasCcResumenes(
  ventas: CcVentaResumen[],
  detalles: VentaDetalleCobranza[]
): CcVentaResumen[] {
  const map = new Map(detalles.map((d) => [d.id, d]))
  return ventas.map((v) => enriquecerVentaResumen(v, map.get(v.id)))
}

export function buildCobranzasOperacionesCsvRows(items: CcCobranzaVentaItem[]): string[][] {
  const rows: string[][] = [
    [
      'fecha_venta',
      'cliente',
      'numero_venta',
      'vendedor',
      'monto_pendiente',
      'fecha_vencimiento',
      'dias_vencido',
      'bucket',
      'estado_pago'
    ]
  ]
  for (const it of items) {
    rows.push([
      it.fecha_venta,
      it.cliente_nombre,
      it.numero_venta,
      it.nombre_vendedor,
      String(it.monto_pendiente),
      it.fecha_vencimiento,
      String(it.dias_vencido),
      CC_AGING_LABELS[it.bucket],
      it.estado_pago
    ])
  }
  return rows
}
