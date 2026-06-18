import type { ArticuloEmpresaRecord } from '../types/api'

/** Lista 1: efectivo o débito. Lista 2: cuenta corriente. */
export type TipoListaPrecioVentas = 'lista_1' | 'lista_2'

export const LISTAS_PRECIO_VENTAS: Record<
  TipoListaPrecioVentas,
  { id: TipoListaPrecioVentas; label: string; subtitle: string; accent: string }
> = {
  lista_1: {
    id: 'lista_1',
    label: 'Lista 1',
    subtitle: 'Efectivo o débito',
    accent: '#10b981'
  },
  lista_2: {
    id: 'lista_2',
    label: 'Lista 2',
    subtitle: 'Cuenta corriente',
    accent: '#6366f1'
  }
}

export function labelListaPrecio(tipo: TipoListaPrecioVentas | null | undefined): string {
  if (!tipo) return '—'
  const meta = LISTAS_PRECIO_VENTAS[tipo]
  return `${meta.label} · ${meta.subtitle}`
}

export function resolvePrecioLista(
  articulo: Pick<ArticuloEmpresaRecord, 'precio_base' | 'precio_lista_1' | 'precio_lista_2'>,
  lista: TipoListaPrecioVentas
): number | null {
  const base = articulo.precio_lista_1 ?? articulo.precio_base
  if (lista === 'lista_1') {
    const v = articulo.precio_lista_1 ?? articulo.precio_base
    return v != null && Number(v) >= 0 ? Number(v) : null
  }
  const v = articulo.precio_lista_2 ?? base
  return v != null && Number(v) >= 0 ? Number(v) : null
}
