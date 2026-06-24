import { mapEstadoToStatus } from './dataMappers'

export function isOpEnAlmacenEntrega(estado: string): boolean {
  return mapEstadoToStatus(estado) === 'almacen-entrega'
}

export function isOpFinalizadoEnTaller(estado: string): boolean {
  return mapEstadoToStatus(estado) === 'finalizado-taller'
}

export function isOpListaParaRetirar(estado: string): boolean {
  return isOpEnAlmacenEntrega(estado)
}
