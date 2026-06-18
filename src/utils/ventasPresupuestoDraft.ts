import type { TipoListaPrecioVentas } from '../constants/ventasListasPrecio'

export const VENTAS_PRESUPUESTO_DRAFT_KEY = 'ventasPresupuestoDraft'

export type VentasPresupuestoDraftItem = {
  id_articulo_empresa?: number
  id_articulo_stock?: number
  codigo_articulo?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
  precio_total: number
}

export type VentasPresupuestoDraft = {
  tipoLista: TipoListaPrecioVentas
  items: VentasPresupuestoDraftItem[]
}

export function guardarVentasPresupuestoDraft(draft: VentasPresupuestoDraft): void {
  try {
    sessionStorage.setItem(VENTAS_PRESUPUESTO_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function leerVentasPresupuestoDraft(): VentasPresupuestoDraft | null {
  try {
    const raw = sessionStorage.getItem(VENTAS_PRESUPUESTO_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VentasPresupuestoDraft
    if (!parsed?.tipoLista || !Array.isArray(parsed.items) || parsed.items.length === 0) return null
    if (parsed.tipoLista !== 'lista_1' && parsed.tipoLista !== 'lista_2') return null
    return parsed
  } catch {
    return null
  }
}

export function limpiarVentasPresupuestoDraft(): void {
  try {
    sessionStorage.removeItem(VENTAS_PRESUPUESTO_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}
