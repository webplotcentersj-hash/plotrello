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

type VentaDetalleCobranza = Pick<
  Venta,
  'id' | 'id_vendedor' | 'nombre_vendedor' | 'monto_pagado' | 'estado_pago' | 'fecha_venta' | 'valor_total'
>

export function enriquecerVentaResumen(
  venta: CcVentaResumen,
  detalle?: VentaDetalleCobranza | null
): CcVentaResumen {
  const total = Number(detalle?.valor_total ?? venta.valor_total) || 0
  const pagado = Number(detalle?.monto_pagado) || 0
  const pendiente =
    venta.estado_pago === 'Pagado' || venta.estado_pago === 'Cancelado'
      ? 0
      : Math.max(0, total - pagado)
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
    monto_pagado: pagado,
    monto_pendiente: pendiente,
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
