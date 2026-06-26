import type { TipoListaPrecioVentas } from './ventasListasPrecio'

export type MedioPagoCodigo =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta'
  | 'Cheque'
  | 'Cuenta Corriente'
  | 'Mercado Pago'
  | 'Otro'

export interface MedioPagoConfig {
  codigo: MedioPagoCodigo
  label: string
  activo: boolean
  orden: number
  lista_precio: TipoListaPrecioVentas
  requiere_comprobante?: boolean
  genera_qr_mp?: boolean
}

export interface TipoChequeConfig {
  id: string
  label: string
  activo: boolean
}

export interface ConfigCondicionesVenta {
  medios: MedioPagoConfig[]
  cuentas_transferencia_ids: number[]
  tipos_cheque: TipoChequeConfig[]
  plazos_cheque: string[]
  bancos_cheque: string[]
  transferencia_requiere_comprobante: boolean
}

export interface VentaDetallePago {
  id_cuenta_bancaria?: number
  banco_destino?: string
  cbu?: string
  alias?: string
  titular_cuenta?: string
  tipo_cheque?: string
  tipo_cheque_label?: string
  banco_cheque?: string
  numero_cheque?: string
  plazo_cheque?: string
  fecha_cheque?: string
  titular_cheque?: string
  cuit_titular_cheque?: string
  mp_checkout_id?: string
  mp_payment_id?: string
  mp_preference_id?: string
}

export const DEFAULT_CONFIG_CONDICIONES_VENTA: ConfigCondicionesVenta = {
  medios: [
    { codigo: 'Efectivo', label: 'Efectivo', activo: true, orden: 1, lista_precio: 'lista_1' },
    {
      codigo: 'Transferencia',
      label: 'Transferencia',
      activo: true,
      orden: 2,
      lista_precio: 'lista_1',
      requiere_comprobante: true
    },
    {
      codigo: 'Mercado Pago',
      label: 'Mercado Pago',
      activo: true,
      orden: 3,
      lista_precio: 'lista_1',
      genera_qr_mp: true
    },
    { codigo: 'Tarjeta', label: 'Tarjeta', activo: true, orden: 4, lista_precio: 'lista_1' },
    { codigo: 'Cheque', label: 'Cheque', activo: true, orden: 5, lista_precio: 'lista_1' },
    {
      codigo: 'Cuenta Corriente',
      label: 'Cuenta Corriente',
      activo: true,
      orden: 6,
      lista_precio: 'lista_2'
    },
    { codigo: 'Otro', label: 'Otro', activo: true, orden: 7, lista_precio: 'lista_1' }
  ],
  cuentas_transferencia_ids: [],
  tipos_cheque: [
    { id: 'fisico', label: 'Cheque físico', activo: true },
    { id: 'echeq', label: 'E-Cheq', activo: true },
    { id: 'cpd', label: 'Cheque pago diferido (CPD)', activo: true },
    { id: 'diferido', label: 'Cheque diferido', activo: true }
  ],
  plazos_cheque: ['Al día', '30 días', '60 días', '90 días', '120 días'],
  bancos_cheque: [
    'Banco Nación',
    'Banco Provincia',
    'Galicia',
    'Santander',
    'BBVA',
    'Macro',
    'ICBC',
    'Credicoop',
    'Supervielle',
    'Otro'
  ],
  transferencia_requiere_comprobante: true
}

export function normalizarConfigCondicionesVenta(raw: unknown): ConfigCondicionesVenta {
  const base = DEFAULT_CONFIG_CONDICIONES_VENTA
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>

  const mediosRaw = Array.isArray(o.medios) ? o.medios : base.medios
  const mediosMap = new Map(base.medios.map((m) => [m.codigo, { ...m }]))
  for (const item of mediosRaw) {
    if (!item || typeof item !== 'object') continue
    const m = item as Record<string, unknown>
    const codigo = String(m.codigo || '') as MedioPagoCodigo
    if (!mediosMap.has(codigo)) continue
    const prev = mediosMap.get(codigo)!
    mediosMap.set(codigo, {
      ...prev,
      label: String(m.label || prev.label),
      activo: m.activo !== false,
      orden: Number(m.orden) || prev.orden,
      lista_precio: m.lista_precio === 'lista_2' ? 'lista_2' : 'lista_1',
      requiere_comprobante: m.requiere_comprobante === true,
      genera_qr_mp: m.genera_qr_mp === true
    })
  }

  const tiposCheque = Array.isArray(o.tipos_cheque)
    ? (o.tipos_cheque as TipoChequeConfig[]).filter((t) => t?.id && t?.label)
    : base.tipos_cheque

  const plazos = Array.isArray(o.plazos_cheque)
    ? (o.plazos_cheque as string[]).map((s) => String(s).trim()).filter(Boolean)
    : base.plazos_cheque

  const bancos = Array.isArray(o.bancos_cheque)
    ? (o.bancos_cheque as string[]).map((s) => String(s).trim()).filter(Boolean)
    : base.bancos_cheque

  const cuentasIds = Array.isArray(o.cuentas_transferencia_ids)
    ? (o.cuentas_transferencia_ids as unknown[])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    : []

  return {
    medios: [...mediosMap.values()].sort((a, b) => a.orden - b.orden),
    cuentas_transferencia_ids: cuentasIds,
    tipos_cheque: tiposCheque.length ? tiposCheque : base.tipos_cheque,
    plazos_cheque: plazos.length ? plazos : base.plazos_cheque,
    bancos_cheque: bancos.length ? bancos : base.bancos_cheque,
    transferencia_requiere_comprobante: o.transferencia_requiere_comprobante !== false
  }
}

export function mediosPagoActivos(config: ConfigCondicionesVenta): MedioPagoConfig[] {
  return config.medios.filter((m) => m.activo).sort((a, b) => a.orden - b.orden)
}

export function listaFromMedioPago(
  codigo: MedioPagoCodigo,
  config: ConfigCondicionesVenta
): TipoListaPrecioVentas {
  const medio = config.medios.find((m) => m.codigo === codigo)
  return medio?.lista_precio === 'lista_2' ? 'lista_2' : 'lista_1'
}

export function esMercadoPago(codigo: string): boolean {
  return codigo === 'Mercado Pago'
}

export function resumenDetallePago(detalle: VentaDetallePago | null | undefined): string {
  if (!detalle) return ''
  const partes: string[] = []
  if (detalle.banco_destino) partes.push(`Banco: ${detalle.banco_destino}`)
  if (detalle.cbu) partes.push(`CBU: ${detalle.cbu}`)
  if (detalle.alias) partes.push(`Alias: ${detalle.alias}`)
  if (detalle.tipo_cheque_label || detalle.tipo_cheque) {
    partes.push(`Tipo: ${detalle.tipo_cheque_label || detalle.tipo_cheque}`)
  }
  if (detalle.banco_cheque) partes.push(`Banco cheque: ${detalle.banco_cheque}`)
  if (detalle.numero_cheque) partes.push(`Nº ${detalle.numero_cheque}`)
  if (detalle.plazo_cheque) partes.push(`Plazo: ${detalle.plazo_cheque}`)
  if (detalle.fecha_cheque) partes.push(`Fecha: ${detalle.fecha_cheque}`)
  if (detalle.titular_cheque) partes.push(`Titular: ${detalle.titular_cheque}`)
  if (detalle.mp_payment_id) partes.push(`MP Pago: ${detalle.mp_payment_id}`)
  return partes.join(' · ')
}
