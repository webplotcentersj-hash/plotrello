/** Rutas unificadas del módulo Ventas (pipeline, venta rápida, oportunidades). */
export const VENTAS = '/ventas'
export const VENTAS_REPORTES = '/ventas/reportes'

export function ventasConVentaId(id: number | string): string {
  return `${VENTAS}?ventaId=${id}`
}

export function ventasConOportunidadId(id: number | string): string {
  return `${VENTAS}?oportunidadId=${id}`
}

export function ventasNuevaVenta(): string {
  return `${VENTAS}?nueva=1`
}
