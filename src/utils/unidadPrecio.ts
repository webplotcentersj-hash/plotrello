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

/** Unidades/hojas de a 1; metros y kg aceptan centésimas (6,25 m²). */
export function pasoCantidadUnidad(raw?: string | null): number {
  const id = normalizarUnidadPrecio(raw)
  return id === 'u' || id === 'hoja' ? 1 : 0.01
}

export function cantidadMinimaUnidad(raw?: string | null): number {
  return pasoCantidadUnidad(raw)
}

export function parseCantidadInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t || t === '.' || t === '-' || t === '-.') return null
  if (!/^-?\d*[.]?\d*$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function formatCantidadInput(q: number): string {
  if (!Number.isFinite(q)) return ''
  const r = Math.round(q * 1000) / 1000
  return String(r).replace('.', ',')
}

export function importeLineaVenta(precioUnitario: number, cantidad: number, descuento = 0): number {
  return Math.round((Number(precioUnitario || 0) * Number(cantidad || 0) - Number(descuento || 0)) * 100) / 100
}

/** Descuento del ítem en venta rápida: porcentaje 0–100. */
export function clampDescuentoPct(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0
  return Math.min(100, Math.round(pct * 100) / 100)
}

export function descuentoPesosDesdePct(precioUnitario: number, cantidad: number, pct = 0): number {
  const bruto = Number(precioUnitario || 0) * Number(cantidad || 0)
  return Math.round(bruto * (clampDescuentoPct(pct) / 100) * 100) / 100
}

export function importeLineaVentaPct(precioUnitario: number, cantidad: number, pct = 0): number {
  const bruto = Number(precioUnitario || 0) * Number(cantidad || 0)
  return Math.round((bruto - descuentoPesosDesdePct(precioUnitario, cantidad, pct)) * 100) / 100
}

export function porcentajeDesdeDescuentoPesos(precioUnitario: number, cantidad: number, descuentoPesos = 0): number {
  const bruto = Number(precioUnitario || 0) * Number(cantidad || 0)
  if (bruto <= 0) return 0
  return clampDescuentoPct((Number(descuentoPesos) || 0) / bruto * 100)
}

/** Precio unitario ya neto del descuento en pesos (para facturar el importe cobrado). */
export function precioUnitarioTrasDescuentoPesos(
  precioUnitario: number,
  cantidad: number,
  descuentoPesos = 0
): number {
  const qty = Number(cantidad) || 0
  const total = importeLineaVenta(precioUnitario, qty, descuentoPesos)
  if (qty <= 0) return Math.max(0, total)
  return Math.round((total / qty) * 100) / 100
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
