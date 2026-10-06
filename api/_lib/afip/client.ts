import type { AfipAmbiente, AfipConfigResumen } from './types'

/** CUIT de prueba AfipSDK (homologación sin certificado propio). */
export const AFIP_DEV_CUIT = 20409378472

export type CreateAfipClientOptions = {
  config?: AfipConfigResumen | null
}

type WsfeClient = {
  ElectronicBilling: {
    getLastVoucher: (puntoVenta: number, cbteTipo: number) => Promise<number>
    getVoucherInfo: (numero: number, puntoVenta: number, cbteTipo: number) => Promise<unknown>
    createVoucher: (data: Record<string, unknown>, returnResponse?: boolean) => Promise<unknown>
  }
  CUIT?: number
  options?: { production?: boolean }
}

function parseCuit(value: string | number | undefined | null, production: boolean): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const digits = String(value || '').replace(/\D/g, '')
  const n = Number(digits)
  if (digits.length === 11 && Number.isFinite(n)) return n
  if (production) {
    throw new Error('CUIT del emisor inválido o vacío. Revisá AFIP_CUIT o Contable → Configuración AFIP.')
  }
  return AFIP_DEV_CUIT
}

function isProductionAmbiente(ambiente?: AfipAmbiente | string | null): boolean {
  return ambiente === 'Producción'
}

export function getAfipAccessToken(): string {
  return (process.env.AFIP_ACCESS_TOKEN || '').trim()
}

/**
 * Misma llamada que hace @afipsdk/afip.js (POST /v1/afip/requests), con fetch.
 * El paquete CommonJS hacía caer la función de Vercel al arrancar.
 */
async function wsfe(
  token: string,
  production: boolean,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch('https://app.afipsdk.com/api/v1/afip/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'sdk-version-number': '1.2.2',
      'sdk-library': 'javascript',
      'sdk-environment': production ? 'prod' : 'dev'
    },
    body: JSON.stringify({
      method,
      params,
      environment: production ? 'prod' : 'dev',
      wsid: 'wsfe',
      url: production
        ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
        : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
      wsdl: production ? 'wsfe-production.wsdl' : 'wsfe.wsdl',
      soap_v_1_2: true
    })
  })

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const message =
      (data && typeof data.message === 'string' && data.message) ||
      (data && typeof data.error === 'string' && data.error) ||
      `AFIP respondió HTTP ${res.status}`
    const error = new Error(message) as Error & { code?: number }
    if (data && typeof data.code === 'number') error.code = data.code
    throw error
  }
  return data
}

export function createAfipClient(options: CreateAfipClientOptions = {}): WsfeClient {
  const accessToken = getAfipAccessToken()
  if (!accessToken) {
    throw new Error(
      'AFIP_ACCESS_TOKEN no configurado. Obtené uno en https://app.afipsdk.com y agregalo a .env.local / Vercel.'
    )
  }

  const config = options.config
  const production = process.env.AFIP_PRODUCTION === 'true' || isProductionAmbiente(config?.ambiente)
  const cuit = parseCuit(process.env.AFIP_CUIT || config?.cuit, production)

  return {
    CUIT: cuit,
    options: { production },
    ElectronicBilling: {
      async getLastVoucher(puntoVenta, cbteTipo) {
        const data = (await wsfe(accessToken, production, 'FECompUltimoAutorizado', {
          PtoVta: puntoVenta,
          CbteTipo: cbteTipo
        })) as { CbteNro?: number }
        return Number(data?.CbteNro || 0)
      },
      async getVoucherInfo(numero, puntoVenta, cbteTipo) {
        try {
          const data = (await wsfe(accessToken, production, 'FECompConsultar', {
            FeCompConsReq: { CbteNro: numero, PtoVta: puntoVenta, CbteTipo: cbteTipo }
          })) as { ResultGet?: unknown }
          return data?.ResultGet ?? null
        } catch (error) {
          if ((error as { code?: number }).code === 602) return null
          throw error
        }
      },
      async createVoucher(data, returnResponse = false) {
        const voucher = { ...data }
        const req = {
          FeCAEReq: {
            FeCabReq: {
              CantReg: Number(voucher.CbteHasta) - Number(voucher.CbteDesde) + 1,
              PtoVta: voucher.PtoVta,
              CbteTipo: voucher.CbteTipo
            },
            FeDetReq: { FECAEDetRequest: voucher }
          }
        }
        delete voucher.CantReg
        delete voucher.PtoVta
        delete voucher.CbteTipo
        if (voucher.Tributos) voucher.Tributos = { Tributo: voucher.Tributos }
        if (voucher.Iva) voucher.Iva = { AlicIva: voucher.Iva }
        if (voucher.CbtesAsoc) voucher.CbtesAsoc = { CbteAsoc: voucher.CbtesAsoc }
        if (voucher.Compradores) voucher.Compradores = { Comprador: voucher.Compradores }
        if (voucher.Opcionales) voucher.Opcionales = { Opcional: voucher.Opcionales }

        const results = (await wsfe(accessToken, production, 'FECAESolicitar', req)) as {
          FeDetResp?: { FECAEDetResponse?: Record<string, unknown> | Record<string, unknown>[] }
        }
        if (returnResponse) return results
        const det = results.FeDetResp?.FECAEDetResponse
        const first = (Array.isArray(det) ? det[0] : det) || {}
        return { CAE: first.CAE, CAEFchVto: first.CAEFchVto }
      }
    }
  }
}

export function formatNumeroFactura(puntoVenta: number, numeroComprobante: number): string {
  return `${puntoVenta.toString().padStart(4, '0')}-${numeroComprobante.toString().padStart(8, '0')}`
}
