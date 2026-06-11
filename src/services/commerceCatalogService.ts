import type { ArticuloEmpresaRecord, TipoIntencionPedido } from '../types/api'
import { cantidadStockADescontar } from './commerceStockService'

/** Artículo que descuenta stock en venta tipo compra. */
export function articuloPermiteCompra(
  articulo: Pick<ArticuloEmpresaRecord, 'modo_venta'>
): boolean {
  const modo = articulo.modo_venta || 'ambos'
  return modo === 'compra' || modo === 'ambos'
}

export function articuloPermiteCotizacion(
  articulo: Pick<ArticuloEmpresaRecord, 'modo_venta'>
): boolean {
  const modo = articulo.modo_venta || 'ambos'
  return modo === 'cotizacion' || modo === 'ambos'
}

export function articuloPermiteIntencion(
  articulo: Pick<ArticuloEmpresaRecord, 'modo_venta'>,
  tipoIntencion: TipoIntencionPedido
): boolean {
  return tipoIntencion === 'compra' ? articuloPermiteCompra(articulo) : articuloPermiteCotizacion(articulo)
}

export function validarItemsParaIntencion(
  items: Array<{ nombre: string; articulo?: Pick<ArticuloEmpresaRecord, 'modo_venta'> | null }>,
  tipoIntencion: TipoIntencionPedido
): string | null {
  if (tipoIntencion === 'compra') {
    const bloqueados = items.filter((it) => it.articulo && !articuloPermiteCompra(it.articulo))
    if (bloqueados.length) {
      return `Estos productos solo admiten cotización: ${bloqueados.map((b) => b.nombre).join(', ')}`
    }
  } else {
    const bloqueados = items.filter((it) => it.articulo && !articuloPermiteCotizacion(it.articulo))
    if (bloqueados.length) {
      return `Estos productos solo admiten compra directa: ${bloqueados.map((b) => b.nombre).join(', ')}`
    }
  }
  return null
}

export function articuloControlaStockEnCompra(
  articulo: Pick<
    ArticuloEmpresaRecord,
    'controla_stock' | 'modo_venta' | 'id_articulo_stock'
  >
): boolean {
  if (!articulo.controla_stock || !articulo.id_articulo_stock) return false
  const modo = articulo.modo_venta || 'ambos'
  return modo === 'compra' || modo === 'ambos'
}

/** Máximo de unidades vendibles; `null` = sin tope por stock. */
export function cantidadMaximaVendible(
  articulo: Pick<
    ArticuloEmpresaRecord,
    | 'controla_stock'
    | 'modo_venta'
    | 'id_articulo_stock'
    | 'stock_disponible'
    | 'unidades_por_venta'
    | 'nombre'
  >
): number | null {
  if (!articuloControlaStockEnCompra(articulo)) return null
  const stock = articulo.stock_disponible
  if (stock == null || !Number.isFinite(stock)) return 0
  const factor = Number(articulo.unidades_por_venta) > 0 ? Number(articulo.unidades_por_venta) : 1
  return Math.max(0, Math.floor(stock / factor))
}

export type ValidacionCantidadVenta = { ok: true } | { ok: false; error: string; max?: number }

export function validarCantidadVentaComercial(
  articulo: ArticuloEmpresaRecord,
  cantidadDeseada: number,
  tipoIntencion: TipoIntencionPedido = 'compra'
): ValidacionCantidadVenta {
  if (tipoIntencion === 'cotizacion') {
    const qty = Math.floor(cantidadDeseada)
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: 'Cantidad inválida' }
    }
    if (qty > 9999) {
      return { ok: false, error: 'Cantidad máxima 9999', max: 9999 }
    }
    return { ok: true }
  }
  const qty = Math.floor(cantidadDeseada)
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, error: 'Cantidad inválida' }
  }

  const max = cantidadMaximaVendible(articulo)
  if (max === null) {
    if (qty > 999) return { ok: false, error: 'Cantidad máxima 999', max: 999 }
    return { ok: true }
  }

  if (max <= 0) {
    return {
      ok: false,
      error: `Sin stock disponible para "${articulo.nombre}"`,
      max: 0
    }
  }

  if (qty > max) {
    return {
      ok: false,
      error: `Stock insuficiente para "${articulo.nombre}" (máx. ${max})`,
      max
    }
  }

  return { ok: true }
}

/** Stock que se consumiría al vender `cantidad` unidades. */
export function stockRequeridoParaVenta(
  articulo: Pick<ArticuloEmpresaRecord, 'unidades_por_venta'>,
  cantidad: number
): number {
  return cantidadStockADescontar(cantidad, articulo.unidades_por_venta)
}
