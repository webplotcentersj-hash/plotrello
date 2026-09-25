export const UNIDADES_PRECIO = [
  { id: 'm2', corto: 'm²', cantidad: 'm²' },
  { id: 'm', corto: 'm', cantidad: 'Metros' },
  { id: 'u', corto: 'un', cantidad: 'Unidades' },
  { id: 'hoja', corto: 'hoja', cantidad: 'Hojas' },
  { id: 'kg', corto: 'kg', cantidad: 'Kg' }
] as const

export type UnidadPrecioId = (typeof UNIDADES_PRECIO)[number]['id']

export function normalizarUnidadPrecio(raw?: string | null): UnidadPrecioId {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace('²', '2')
  if (!s || s === 'm2' || s === 'metro2' || s === 'metros2' || s.includes('cuadrad')) return 'm2'
  if (s === 'metro' || s === 'metros' || s === 'mt' || s === 'm') return 'm'
  if (s === 'u' || s === 'un' || s === 'unidad' || s === 'unidades') return 'u'
  if (s === 'hoja' || s === 'hojas') return 'hoja'
  if (s === 'kg' || s === 'kilo' || s === 'kilos') return 'kg'
  return 'm2'
}

export function etiquetaUnidadCorta(raw?: string | null): string {
  const id = normalizarUnidadPrecio(raw)
  return UNIDADES_PRECIO.find((u) => u.id === id)?.corto ?? 'm²'
}

export function etiquetaCantidadUnidad(raw?: string | null): string {
  const id = normalizarUnidadPrecio(raw)
  return UNIDADES_PRECIO.find((u) => u.id === id)?.cantidad ?? 'm²'
}

/** Unidad guardada en la descripción del ítem: "Vinilo (m)" o "Vinilo (m²)". */
export function unidadDesdeDescripcionItem(descripcion?: string | null): UnidadPrecioId | null {
  const m = String(descripcion ?? '').match(/\((m²|m2|m|un|hoja|kg)\)\s*$/i)
  if (!m) return null
  return normalizarUnidadPrecio(m[1])
}

/**
 * Metros cuadrados para la ficha: suma las cantidades en m², que es la unidad habitual.
 * Si ningún ítem está en m², usa las cantidades en metros lineales.
 */
export function metrosDesdeItemsVenta(
  items: Array<{ cantidad?: number | null; descripcion?: string | null; unidad_medida?: string | null }> | null | undefined
): string {
  const filas = (items ?? [])
    .map((item) => ({
      unidad: item.unidad_medida
        ? normalizarUnidadPrecio(item.unidad_medida)
        : unidadDesdeDescripcionItem(item.descripcion),
      cantidad: Number(item.cantidad)
    }))
    .filter((item) => item.unidad && Number.isFinite(item.cantidad) && item.cantidad > 0) as Array<{
    unidad: UnidadPrecioId
    cantidad: number
  }>

  const enM2 = filas.filter((item) => item.unidad === 'm2')
  const base = enM2.length > 0 ? enM2 : filas.filter((item) => item.unidad === 'm')
  if (base.length === 0) return ''
  const total = Math.round(base.reduce((sum, item) => sum + item.cantidad, 0) * 100) / 100
  if (!(total > 0)) return ''
  return String(total).replace('.', ',')
}
