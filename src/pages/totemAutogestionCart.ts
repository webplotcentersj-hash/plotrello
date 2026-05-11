import type { ArticuloEmpresaRecord } from '../types/api'

export type TotemCartItem = {
  id_articulo: number
  cantidad: number
  precio_unitario: number
  precio_total: number
  nombre_articulo?: string
}

export type TotemCartState = {
  items: TotemCartItem[]
  updatedAt: number
}

const KEY = 'totem_autogestion_cart_v1'

export function readTotemCart(): TotemCartState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { items: [], updatedAt: Date.now() }
    const parsed = JSON.parse(raw) as Partial<TotemCartState>
    const items = Array.isArray(parsed.items) ? (parsed.items as TotemCartItem[]) : []
    return { items, updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now() }
  } catch {
    return { items: [], updatedAt: Date.now() }
  }
}

export function writeTotemCart(state: TotemCartState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function clearTotemCart() {
  localStorage.removeItem(KEY)
}

export function cartItemCount(items: TotemCartItem[]): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.cantidad) ? it.cantidad : 0), 0)
}

export function cartTotal(items: TotemCartItem[]): number {
  return items.reduce((sum, it) => sum + (Number.isFinite(it.precio_total) ? it.precio_total : 0), 0)
}

export function addArticuloToCart(items: TotemCartItem[], articulo: ArticuloEmpresaRecord): TotemCartItem[] {
  const idx = items.findIndex((i) => i.id_articulo === articulo.id)
  const unit = articulo.precio_base || 0
  if (idx >= 0) {
    const next = [...items]
    const current = next[idx]
    const cantidad = Math.min(999, Math.max(1, (current.cantidad || 0) + 1))
    next[idx] = {
      ...current,
      cantidad,
      precio_unitario: current.precio_unitario ?? unit,
      precio_total: cantidad * (current.precio_unitario ?? unit),
      nombre_articulo: articulo.nombre
    }
    return next
  }
  return [
    ...items,
    {
      id_articulo: articulo.id,
      cantidad: 1,
      precio_unitario: unit,
      precio_total: unit,
      nombre_articulo: articulo.nombre
    }
  ]
}

export function setItemCantidad(items: TotemCartItem[], id_articulo: number, cantidad: number): TotemCartItem[] {
  const idx = items.findIndex((i) => i.id_articulo === id_articulo)
  if (idx < 0) return items
  const next = [...items]
  const current = next[idx]
  const c = Math.min(999, Math.max(1, Math.floor(cantidad)))
  next[idx] = { ...current, cantidad: c, precio_total: c * (current.precio_unitario || 0) }
  return next
}

export function removeItem(items: TotemCartItem[], id_articulo: number): TotemCartItem[] {
  return items.filter((i) => i.id_articulo !== id_articulo)
}

