export type AdjuntoProveedor = { url: string; nombre: string }

export function adjuntosDeMovimiento(m: {
  url_adjunto?: string | null
  url_adjuntos?: Array<{ url: string; nombre?: string }> | string[] | null
}): AdjuntoProveedor[] {
  const out: AdjuntoProveedor[] = []
  const seen = new Set<string>()
  const push = (url?: string | null, nombre?: string) => {
    const u = (url || '').trim()
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push({ url: u, nombre: nombre?.trim() || 'Comprobante' })
  }
  if (Array.isArray(m.url_adjuntos)) {
    for (const item of m.url_adjuntos) {
      if (typeof item === 'string') push(item)
      else push(item?.url, item?.nombre)
    }
  }
  push(m.url_adjunto)
  return out
}

export function inicialesProveedor(nombre: string): string {
  const parts = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1 && !/^(s\.?h\.?|s\.?a\.?|srl|sa|y|de|del|la|el)$/i.test(p))
  const a = parts[0]?.[0] || nombre[0] || '?'
  const b = parts[1]?.[0] || parts[0]?.[1] || ''
  return (a + b).toUpperCase()
}

export function moneyProveedor(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function saldoCuentaProveedor(f: {
  saldo_cuenta?: number | null
  saldo_movimientos?: number | null
  saldo_listado?: number | null
}): number {
  if (f.saldo_cuenta != null && Number.isFinite(Number(f.saldo_cuenta))) return Number(f.saldo_cuenta)
  if (f.saldo_movimientos != null && Number.isFinite(Number(f.saldo_movimientos))) {
    return Number(f.saldo_movimientos)
  }
  return Number(f.saldo_listado) || 0
}

export function estadoCuentaProveedor(saldo: number): {
  label: string
  detalle: string
  frase: string
  cls: string
} {
  if (Math.abs(saldo) < 0.01) {
    return { label: 'Al día', detalle: 'No le debemos', frase: 'No le debemos nada', cls: 'ok' }
  }
  if (saldo > 0) {
    return {
      label: 'Le debemos',
      detalle: moneyProveedor(saldo),
      frase: `Le debemos ${moneyProveedor(saldo)}`,
      cls: 'deuda'
    }
  }
  return {
    label: 'A favor nuestro',
    detalle: moneyProveedor(Math.abs(saldo)),
    frase: `Nos debe ${moneyProveedor(Math.abs(saldo))} (saldo a favor)`,
    cls: 'favor'
  }
}

/** Días hacia adelante que cuentan como “próximo vencimiento”. */
export const PROXIMO_VENCIMIENTO_DIAS = 14

export type EstadoVencimiento = 'vencida' | 'proxima' | 'ok'

function isoDateOnly(raw: string | null | undefined): string {
  return String(raw || '').slice(0, 10)
}

/** Suma días a YYYY-MM-DD (calendario, sin timezone). */
export function sumarDiasIso(iso: string, dias: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso.slice(0, 10)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

export function estadoVencimientoFactura(
  fechaVencimiento: string | null | undefined,
  hoyIso: string
): EstadoVencimiento | null {
  const vto = isoDateOnly(fechaVencimiento)
  if (!vto) return null
  if (vto < hoyIso) return 'vencida'
  const limite = sumarDiasIso(hoyIso, PROXIMO_VENCIMIENTO_DIAS)
  if (vto <= limite) return 'proxima'
  return 'ok'
}

export function etiquetaEstadoVencimiento(estado: EstadoVencimiento | null): string {
  if (estado === 'vencida') return 'Vencida'
  if (estado === 'proxima') return 'Por vencer'
  if (estado === 'ok') return 'Al día'
  return ''
}

export type FacturaVencimientoItem = {
  id: number
  id_proveedor: number | null
  proveedor_nombre: string
  comprobante: string
  fecha_comprobante: string | null
  fecha_vencimiento: string
  monto: number
  estado: EstadoVencimiento
}

/** Facturas (debe) con vencimiento cargado. */
export function facturasConVencimiento(
  movs: Array<{
    id: number
    id_proveedor?: number | null
    proveedor_nombre: string
    comprobante: string
    fecha_comprobante?: string | null
    fecha_vencimiento?: string | null
    debe?: number | null
    haber?: number | null
    tipo_movimiento?: string | null
    es_saldo_inicial?: boolean | null
  }>,
  hoyIso: string
): FacturaVencimientoItem[] {
  const out: FacturaVencimientoItem[] = []
  for (const m of movs) {
    if (m.es_saldo_inicial) continue
    const debe = Number(m.debe) || 0
    const haber = Number(m.haber) || 0
    if (haber > 0.009 || /pago/i.test(m.tipo_movimiento || '')) continue
    if (debe <= 0.009) continue
    const vto = isoDateOnly(m.fecha_vencimiento)
    if (!vto) continue
    const estado = estadoVencimientoFactura(vto, hoyIso)
    if (!estado) continue
    out.push({
      id: m.id,
      id_proveedor: m.id_proveedor ?? null,
      proveedor_nombre: m.proveedor_nombre,
      comprobante: m.comprobante || '—',
      fecha_comprobante: m.fecha_comprobante ? isoDateOnly(m.fecha_comprobante) : null,
      fecha_vencimiento: vto,
      monto: debe,
      estado
    })
  }
  return out.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.id - b.id)
}

/** Vencidas o dentro de la ventana de próximos días. */
export function facturasAlertaVencimiento(
  movs: Parameters<typeof facturasConVencimiento>[0],
  hoyIso: string
): FacturaVencimientoItem[] {
  return facturasConVencimiento(movs, hoyIso).filter((f) => f.estado === 'vencida' || f.estado === 'proxima')
}
