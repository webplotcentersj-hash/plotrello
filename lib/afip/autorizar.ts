import { buildWsfeVoucherData, tipoComprobanteToCbteTipo } from './mapFactura'
import { createAfipClient, formatNumeroFactura } from './client'
import type { AfipConfigResumen, AutorizarFacturaResult, FacturaAfipInput, FacturaReferenciaAfip } from './types'

function extractAfipError(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'Error desconocido de AFIP'
  const r = raw as Record<string, unknown>
  const det = r.FeDetResp as Record<string, unknown> | undefined
  const detalle = det?.FECAEDetResponse
  const first = Array.isArray(detalle) ? detalle[0] : detalle
  if (first && typeof first === 'object') {
    const obs = (first as Record<string, unknown>).Observaciones as Record<string, unknown> | undefined
    const obsArr = obs?.Obs as unknown
    if (Array.isArray(obsArr) && obsArr[0] && typeof obsArr[0] === 'object') {
      const o = obsArr[0] as Record<string, unknown>
      const code = o.Code != null ? `[${o.Code}] ` : ''
      return `${code}${String(o.Msg || 'Rechazado por AFIP')}`
    }
    const resultado = String((first as Record<string, unknown>).Resultado || '')
    if (resultado === 'R') return 'Comprobante rechazado por AFIP'
  }
  return 'No se pudo autorizar el comprobante en AFIP'
}

export async function testAfipConexion(config: AfipConfigResumen | null) {
  const afip = createAfipClient({ config })
  const ws = afip.ElectronicBilling
  const puntoVenta = Number(config?.punto_venta || 1)
  const cbteTipo = 6 // Factura B — prueba habitual en homologación
  const ultimo = await ws.getLastVoucher(puntoVenta, cbteTipo)
  return {
    ambiente: config?.ambiente || 'Testing',
    puntoVenta,
    cbteTipo,
    ultimoNumero: ultimo,
    cuit: (afip as { CUIT?: number }).CUIT,
    production: Boolean((afip as { options?: { production?: boolean } }).options?.production)
  }
}

export async function autorizarFacturaAfip(
  factura: FacturaAfipInput,
  config: AfipConfigResumen | null,
  referencia: FacturaReferenciaAfip
): Promise<AutorizarFacturaResult> {
  const afip = createAfipClient({ config })
  const ws = afip.ElectronicBilling

  const puntoVenta = Number(factura.punto_venta || config?.punto_venta || 1)
  const cbteTipo = tipoComprobanteToCbteTipo(factura.tipo_comprobante)

  let numero = Number(factura.numero_comprobante || 0)
  if (!numero) {
    const last = Number(await ws.getLastVoucher(puntoVenta, cbteTipo))
    numero = last + 1
  } else {
    try {
      const lastAfip = Number(await ws.getLastVoucher(puntoVenta, cbteTipo))
      if (numero <= lastAfip) numero = lastAfip + 1
    } catch {
      // Si falla la consulta, intentamos con el número interno
    }
  }

  const voucherData = buildWsfeVoucherData(factura, {
    puntoVenta,
    numeroComprobante: numero,
    referencia: referencia || undefined
  })

  const raw = await ws.createVoucher(voucherData, true)
  const det = (raw as Record<string, unknown>)?.FeDetResp as Record<string, unknown> | undefined
  const detalle = det?.FECAEDetResponse
  const first = (Array.isArray(detalle) ? detalle[0] : detalle) as Record<string, unknown> | undefined

  const resultado = String(first?.Resultado || '')
  if (resultado !== 'A') {
    throw new Error(extractAfipError(raw))
  }

  const cae = String(first?.CAE || '')
  const caeVencimientoRaw = String(first?.CAEFchVto || '')
  const caeVencimiento =
    caeVencimientoRaw.length === 8
      ? `${caeVencimientoRaw.slice(0, 4)}-${caeVencimientoRaw.slice(4, 6)}-${caeVencimientoRaw.slice(6, 8)}`
      : caeVencimientoRaw

  return {
    cae,
    caeVencimiento,
    numeroComprobante: numero,
    puntoVenta,
    resultado,
    observaciones: null,
    raw
  }
}

export function buildNumeroFacturaFromAutorizacion(puntoVenta: number, numeroComprobante: number): string {
  return formatNumeroFactura(puntoVenta, numeroComprobante)
}
