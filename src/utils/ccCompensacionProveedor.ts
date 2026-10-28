import { normalizarDniCuit } from './buscarClienteMatch'
import { saldoCuentaProveedor } from './proveedorCuenta'

export type ProveedorVinculoCc = {
  id: number
  nombre: string
  cuit: string | null
  saldoProveedor: number
}

/** CUIT/DNI comparable (solo dígitos). */
export function cuitClave(value: string | null | undefined): string {
  return normalizarDniCuit(value || '')
}

export function cuitCoincide(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = cuitClave(a)
  const y = cuitClave(b)
  if (!x || !y) return false
  if (x === y) return true
  // DNI 7–8 dígitos vs CUIT 11: comparar núcleo
  if (x.length >= 7 && y.length === 11 && y.slice(2, 2 + x.length) === x) return true
  if (y.length >= 7 && x.length === 11 && x.slice(2, 2 + y.length) === y) return true
  return false
}

/**
 * Saldo cliente CC (+ = nos deben) vs saldo proveedor (+ = le debemos).
 * Neto a favor Plot = saldoCliente − saldoProveedor.
 */
export function posicionNetaCruzada(saldoCliente: number, saldoProveedor: number): {
  neto: number
  maxCompensable: number
  puedeCompensar: boolean
} {
  const sc = Number(saldoCliente) || 0
  const sp = Number(saldoProveedor) || 0
  const maxCompensable = Math.max(0, Math.min(Math.max(0, sc), Math.max(0, sp)))
  return {
    neto: sc - sp,
    maxCompensable,
    puedeCompensar: maxCompensable > 0.009
  }
}

export function pickProveedorVinculo<
  T extends {
    id: number
    nombre: string
    razon_social?: string | null
    cuit?: string | null
    finanzas?: {
      saldo_cuenta?: number | null
      saldo_movimientos?: number | null
      saldo_listado?: number | null
    }
  }
>(proveedores: T[], cuitCliente: string | null | undefined): ProveedorVinculoCc | null {
  const clave = cuitClave(cuitCliente)
  if (!clave) return null
  const hit = proveedores.find((p) => cuitCoincide(p.cuit, cuitCliente))
  if (!hit) return null
  return {
    id: hit.id,
    nombre: (hit.razon_social || hit.nombre || `Proveedor #${hit.id}`).trim(),
    cuit: hit.cuit ?? null,
    saldoProveedor: saldoCuentaProveedor(hit.finanzas || {})
  }
}
