import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from './staffSession'
import type { FacturaVentaRecord } from '../types/api'
import type { CertificadoAfipInfo } from '../utils/certificadoAfip'
import { guardarBlob } from '../utils/descargarArchivo'

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

/** Vencimiento del certificado de ARCA que usa el servidor. No llama a ARCA: solo lee el certificado. */
export async function consultarCertificadoAFIP(): Promise<{
  success: boolean
  data?: CertificadoAfipInfo
  error?: string
}> {
  try {
    const res = await plotLabFetch('/api/erp/afip-test', {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({ solo_certificado: true })
    })
    const json = (await res.json().catch(() => null)) as {
      success?: boolean
      data?: { certificado?: CertificadoAfipInfo }
      error?: string
    } | null
    if (!res.ok || !json?.success || !json.data?.certificado) {
      return { success: false, error: json?.error || `HTTP ${res.status}` }
    }
    return { success: true, data: json.data.certificado }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
  if (!match?.[1]) return fallback
  try {
    return decodeURIComponent(match[1].replace(/"/g, '').trim())
  } catch {
    return match[1].replace(/"/g, '').trim() || fallback
  }
}

/** PDF oficial de AfipSDK (mismo template que app.afipsdk.com). Solo comprobantes con CAE. */
export async function obtenerPdfFacturaAfip(idFactura: number): Promise<{ blob: Blob; nombre: string }> {
  const res = await plotLabFetch('/api/erp/afip-pdf', {
    method: 'POST',
    headers: staffHeaders(),
    body: JSON.stringify({ id_factura: idFactura })
  })
  const tipo = res.headers.get('Content-Type') || ''
  if (!res.ok || !tipo.includes('pdf')) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(json?.error || `No se pudo descargar el PDF (HTTP ${res.status}).`)
  }
  const blob = await res.blob()
  const nombre = filenameFromDisposition(res.headers.get('Content-Disposition'), `factura-${idFactura}.pdf`)
  return { blob, nombre }
}

/** Descarga el PDF oficial de AfipSDK de un comprobante con CAE. */
export async function descargarPdfFacturaAfip(idFactura: number): Promise<void> {
  const { blob, nombre } = await obtenerPdfFacturaAfip(idFactura)
  guardarBlob(blob, nombre)
}

/**
 * Autoriza en AFIP y, con CAE, emite el comprobante (CxC, nota de crédito y asiento se generan en el servidor).
 * También sirve para reintentar una autorización fallida o completar efectos pendientes.
 */
export async function autorizarFacturaAFIP(idFactura: number): Promise<{
  success: boolean
  data?: FacturaVentaRecord
  error?: string
  /** Autorizada, pero algo posterior (CxC / asiento) quedó pendiente. */
  warning?: string
}> {
  try {
    const res = await plotLabFetch('/api/erp/afip-autorizar', {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({ id_factura: idFactura })
    })
    const raw = await res.text()
    const json = (() => {
      try {
        return raw ? (JSON.parse(raw) as {
          success?: boolean
          data?: FacturaVentaRecord
          error?: string
          warning?: string
        }) : null
      } catch {
        return null
      }
    })()
    if (!res.ok || !json?.success) {
      const detalle = typeof json?.error === 'string' && json.error.trim()
        ? json.error
        : raw.replace(/\s+/g, ' ').trim().slice(0, 280)
      return { success: false, error: detalle || `HTTP ${res.status}` }
    }
    return { success: true, data: json.data, warning: json.warning }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}
