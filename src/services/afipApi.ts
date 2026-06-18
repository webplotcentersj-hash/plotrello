import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from './staffSession'
import type { FacturaVentaRecord } from '../types/api'

function staffHeaders(): HeadersInit {
  const token = getStaffAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export type AfipTestConexionResult = {
  ambiente: string
  puntoVenta: number
  cbteTipo: number
  ultimoNumero: number
  cuit?: number
  production?: boolean
}

export async function probarConexionAFIP(): Promise<{
  success: boolean
  data?: AfipTestConexionResult
  error?: string
}> {
  try {
    const res = await plotLabFetch('/api/erp/afip-test', {
      method: 'POST',
      headers: staffHeaders()
    })
    const json = (await res.json().catch(() => null)) as {
      success?: boolean
      data?: AfipTestConexionResult
      error?: string
    } | null
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `HTTP ${res.status}` }
    }
    return { success: true, data: json.data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}

export async function autorizarFacturaAFIP(idFactura: number): Promise<{
  success: boolean
  data?: FacturaVentaRecord
  error?: string
}> {
  try {
    const res = await plotLabFetch('/api/erp/afip-autorizar', {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({ id_factura: idFactura })
    })
    const json = (await res.json().catch(() => null)) as {
      success?: boolean
      data?: FacturaVentaRecord
      error?: string
    } | null
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `HTTP ${res.status}` }
    }
    return { success: true, data: json.data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}
