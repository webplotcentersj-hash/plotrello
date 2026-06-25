import type { ArticuloEmpresaRecord } from '../types/api'

export function getProductosDestacados(
  articulos: ArticuloEmpresaRecord[],
  limite = 12
): ArticuloEmpresaRecord[] {
  const conImagen = articulos.filter((a) => a.imagen_url)
  const base = conImagen.length > 0 ? conImagen : articulos
  return base.slice(0, limite)
}

export function getProductosMasVendidos(
  articulos: ArticuloEmpresaRecord[],
  masVendidosIds: number[],
  limite = 8
): ArticuloEmpresaRecord[] {
  if (masVendidosIds.length === 0) {
    return articulos.filter((a) => a.imagen_url).slice(0, limite)
  }
  const orden = new Map(masVendidosIds.map((id, i) => [id, i]))
  return articulos
    .filter((a) => orden.has(a.id))
    .sort((a, b) => (orden.get(a.id) ?? 99) - (orden.get(b.id) ?? 99))
    .slice(0, limite)
}

/** Productos de la misma subcategoría/categoría, excluyendo el actual. */
export function getProductosRelacionados(
  articulo: ArticuloEmpresaRecord,
  todos: ArticuloEmpresaRecord[],
  masVendidosIds: number[] = [],
  limite = 6
): ArticuloEmpresaRecord[] {
  const otros = todos.filter((a) => a.id !== articulo.id)
  const vistos = new Set<number>()
  const out: ArticuloEmpresaRecord[] = []

  const push = (lista: ArticuloEmpresaRecord[]) => {
    for (const a of lista) {
      if (out.length >= limite) break
      if (vistos.has(a.id)) continue
      vistos.add(a.id)
      out.push(a)
    }
  }

  if (articulo.subcategoria) {
    push(otros.filter((a) => a.subcategoria === articulo.subcategoria))
  }
  if (articulo.categoria) {
    push(otros.filter((a) => a.categoria === articulo.categoria))
  }

  if (out.length < limite && masVendidosIds.length) {
    const orden = new Map(masVendidosIds.map((id, i) => [id, i]))
    push(
      [...otros]
        .filter((a) => orden.has(a.id))
        .sort((a, b) => (orden.get(a.id) ?? 99) - (orden.get(b.id) ?? 99))
    )
  }

  if (out.length < limite) {
    push(otros.filter((a) => a.imagen_url))
  }

  push(otros)
  return out.slice(0, limite)
}

export function getProductosPorCategoria(
  articulos: ArticuloEmpresaRecord[],
  categoria: string,
  limite = 12
): ArticuloEmpresaRecord[] {
  return articulos.filter((a) => a.categoria === categoria).slice(0, limite)
}
