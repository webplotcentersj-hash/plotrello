import type { ArticuloEmpresaRecord } from '../types/api'

/** Lista 1: efectivo o débito. Lista 2: cuenta corriente. */
export type TipoListaPrecioVentas = 'lista_1' | 'lista_2'

export type NumeroListaPrecio = 1 | 2 | 3 | 4 | 5

export type RecargoPrecioVentas = {
  id: string
  nombre: string
  porcentaje: number
  activo: boolean
}

export type ConfigAjustesPreciosVentas = {
  iva_porcentaje: number
  iva_activo: boolean
  recargos: RecargoPrecioVentas[]
}

export const DEFAULT_AJUSTES_PRECIOS_VENTAS: ConfigAjustesPreciosVentas = {
  iva_porcentaje: 21,
  iva_activo: true,
  recargos: []
}

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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function tipoListaToNumero(tipo: TipoListaPrecioVentas): NumeroListaPrecio {
  return tipo === 'lista_1' ? 1 : 2
}

export function labelListaPrecio(tipo: TipoListaPrecioVentas | null | undefined): string {
  if (!tipo) return '—'
  const meta = LISTAS_PRECIO_VENTAS[tipo]
  return `${meta.label} · ${meta.subtitle}`
}

/** Precio neto Flexxus (sin IVA ni recargos globales). */
export function resolvePrecioListaBruto(
  articulo: Pick<
    ArticuloEmpresaRecord,
    'precio_base' | 'precio_lista_1' | 'precio_lista_2' | 'precio_lista_3' | 'precio_lista_4' | 'precio_lista_5'
  >,
  lista: TipoListaPrecioVentas | NumeroListaPrecio
): number | null {
  const n = typeof lista === 'number' ? lista : tipoListaToNumero(lista)
  const fallbackL1 = articulo.precio_lista_1 ?? articulo.precio_base

  const pick = (v: number | null | undefined): number | null =>
    v != null && Number(v) >= 0 ? Number(v) : null

  switch (n) {
    case 1:
      return pick(articulo.precio_lista_1 ?? articulo.precio_base)
    case 2:
      return pick(articulo.precio_lista_2 ?? fallbackL1)
    case 3:
      return pick(articulo.precio_lista_3 ?? fallbackL1)
    case 4:
      return pick(articulo.precio_lista_4 ?? fallbackL1)
    case 5:
      return pick(articulo.precio_lista_5 ?? fallbackL1)
    default:
      return null
  }
}

export function normalizarConfigAjustesPrecios(
  raw: Partial<ConfigAjustesPreciosVentas> | null | undefined
): ConfigAjustesPreciosVentas {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AJUSTES_PRECIOS_VENTAS, recargos: [] }

  const recargos = Array.isArray(raw.recargos)
    ? raw.recargos
        .map((r, i) => ({
          id: String(r?.id || `recargo-${i}`),
          nombre: String(r?.nombre || 'Recargo').trim() || 'Recargo',
          porcentaje: Math.max(0, Number(r?.porcentaje) || 0),
          activo: r?.activo !== false
        }))
        .filter((r) => r.nombre)
    : []

  return {
    iva_porcentaje: Math.max(0, Number(raw.iva_porcentaje ?? 21) || 0),
    iva_activo: raw.iva_activo !== false,
    recargos
  }
}

export type DesgloseAjustePrecio = {
  nombre: string
  porcentaje: number
  monto: number
}

export function calcularAjustesPrecio(
  precioBruto: number,
  config: ConfigAjustesPreciosVentas
): { final: number; totalPorcentaje: number; desglose: DesgloseAjustePrecio[] } {
  const bruto = Number(precioBruto)
  if (!Number.isFinite(bruto) || bruto < 0) {
    return { final: 0, totalPorcentaje: 0, desglose: [] }
  }

  const desglose: DesgloseAjustePrecio[] = []
  let totalPorcentaje = 0

  if (config.iva_activo && config.iva_porcentaje > 0) {
    totalPorcentaje += config.iva_porcentaje
    desglose.push({
      nombre: 'IVA',
      porcentaje: config.iva_porcentaje,
      monto: round2(bruto * (config.iva_porcentaje / 100))
    })
  }

  for (const r of config.recargos) {
    if (!r.activo || r.porcentaje <= 0) continue
    totalPorcentaje += r.porcentaje
    desglose.push({
      nombre: r.nombre,
      porcentaje: r.porcentaje,
      monto: round2(bruto * (r.porcentaje / 100))
    })
  }

  const final = round2(bruto * (1 + totalPorcentaje / 100))
  return { final, totalPorcentaje, desglose }
}

/** Precio de venta (neto + IVA y recargos globales). */
export function resolvePrecioLista(
  articulo: Pick<
    ArticuloEmpresaRecord,
    'precio_base' | 'precio_lista_1' | 'precio_lista_2' | 'precio_lista_3' | 'precio_lista_4' | 'precio_lista_5'
  >,
  lista: TipoListaPrecioVentas | NumeroListaPrecio,
  ajustes: ConfigAjustesPreciosVentas = DEFAULT_AJUSTES_PRECIOS_VENTAS
): number | null {
  const bruto = resolvePrecioListaBruto(articulo, lista)
  if (bruto == null) return null
  return calcularAjustesPrecio(bruto, ajustes).final
}

export function labelAjustesPreciosActivos(config: ConfigAjustesPreciosVentas): string {
  const partes: string[] = []
  if (config.iva_activo && config.iva_porcentaje > 0) {
    partes.push(`IVA ${config.iva_porcentaje}%`)
  }
  for (const r of config.recargos) {
    if (r.activo && r.porcentaje > 0) partes.push(`${r.nombre} ${r.porcentaje}%`)
  }
  return partes.length ? partes.join(' + ') : 'Sin ajustes'
}

export function totalPorcentajeAjustes(config: ConfigAjustesPreciosVentas): number {
  let t = 0
  if (config.iva_activo) t += config.iva_porcentaje
  for (const r of config.recargos) {
    if (r.activo) t += r.porcentaje
  }
  return t
}
