export const CLIENTES_DASHBOARD = '/clientes/dashboard'
export const CLIENTES_BUSCAR = '/clientes/buscar'
export const CLIENTES_FRECUENTES = '/clientes/frecuentes'
export const CLIENTES_CUENTA_CORRIENTE = '/clientes/cuenta-corriente'
export const CLIENTES_AGREGAR = '/clientes/agregar'
export const CLIENTES_WEB_GESTION = '/clientes-web/gestion'
export const ATENCION_PUBLICO = '/atencion-publico'

export function clientesCcPerfil(idCliente: number | string): string {
  return `${CLIENTES_CUENTA_CORRIENTE}/cliente/${idCliente}`
}

export function clientesPerfil(idCliente: number | string): string {
  return `/clientes/cliente/${idCliente}`
}
