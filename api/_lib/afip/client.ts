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

/** PEM real, o nada si la variable es una ruta de archivo. AfipSDK usa el certificado de la cuenta. */
export function normalizarPem(value: string | undefined): string | undefined {
  if (!value) return undefined
  let raw = value.trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim()
  }
  if (raw.includes('\\n')) raw = raw.replace(/\\n/g, '\n')
  if (!raw.includes('-----BEGIN')) return undefined
  return raw
}

type TicketAcceso = { token: string; sign: string; until: number }
const tickets = new Map<string, TicketAcceso>()
const TICKET_TTL_MS = 10 * 60 * 60 * 1000

function sdkHeaders(accessToken: string, production: boolean): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'sdk-version-number': '1.2.2',
    'sdk-library': 'javascript',
    'sdk-environment': production ? 'prod' : 'dev'
  }
}

function mensajeHttp(data: Record<string, unknown> | null, status: number): string {
  return (
    (data && typeof data.message === 'string' && data.message) ||
    (data && typeof data.error === 'string' && data.error) ||
    `ARCA respondió HTTP ${status}`
  )
}

/** El SDK pide el ticket (WSAA) y recién después llama al webservice. */
async function ticketAcceso(accessToken: string, production: boolean, cuit: number): Promise<TicketAcceso> {
  const clave = `${production ? 'prod' : 'dev'}:${cuit}`
  const vigente = tickets.get(clave)
  if (vigente && vigente.until > Date.now()) return vigente

  const body: Record<string, unknown> = {
    environment: production ? 'prod' : 'dev',
    wsid: 'wsfe',
    tax_id: cuit,
    force_create: false
  }
  const cert = normalizarPem(process.env.AFIP_CERT)
  const key = normalizarPem(process.env.AFIP_KEY)
  if (cert && key) {
    body.cert = cert
    body.key = key
  }

  const res = await fetch('https://app.afipsdk.com/api/v1/afip/auth', {
    method: 'POST',
    headers: sdkHeaders(accessToken, production),
    body: JSON.stringify(body)
  })
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) throw new Error(mensajeHttp(data, res.status))
  const token = typeof data?.token === 'string' ? data.token : ''
  const sign = typeof data?.sign === 'string' ? data.sign : ''
  if (!token || !sign) throw new Error('ARCA no devolvió el ticket de acceso.')
  const ticket = { token, sign, until: Date.now() + TICKET_TTL_MS }
  tickets.set(clave, ticket)
  return ticket
}

/** La respuesta HTTP viene envuelta en `{ MetodoResult: ... }`, igual que el SDK. */
export function unwrapAfipResult(method: string, data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}
  const record = data as Record<string, unknown>
  const nested = record[`${method}Result`]
  if (nested && typeof nested === 'object') return nested as Record<string, unknown>
  return record
}

function primerError(err: unknown): Record<string, unknown> | null {
  if (Array.isArray(err)) return (err[0] as Record<string, unknown>) || null
  if (err && typeof err === 'object') return err as Record<string, unknown>
  return null
}

/**
 * Igual que ElectronicBilling._checkErrors: un rechazo trae código y texto.
 * Devuelve null si ARCA aprobó.
 */
export function rechazoAfip(method: string, result: Record<string, unknown>): { message: string; code?: number } | null {
  if (method === 'FECAESolicitar' && result.FeDetResp && typeof result.FeDetResp === 'object') {
    const det = result.FeDetResp as Record<string, unknown>
    let first = det.FECAEDetResponse
    if (Array.isArray(first)) {
      if (first.length > 1) return null
      first = first[0]
      det.FECAEDetResponse = first
    }
    if (first && typeof first === 'object') {
      const row = first as Record<string, unknown>
      const obs = row.Observaciones as Record<string, unknown> | undefined
      if (obs?.Obs && row.Resultado !== 'A') result.Errors = { Err: obs.Obs }
    }
  }
  if (!result.Errors || typeof result.Errors !== 'object') return null
  const err = primerError((result.Errors as Record<string, unknown>).Err)
  if (!err) return { message: 'ARCA rechazó el comprobante.' }
  const code = Number(err.Code)
  const msg = String(err.Msg || 'ARCA rechazó el comprobante.')
  return {
    message: Number.isFinite(code) ? `(${code}) ${msg}` : msg,
    code: Number.isFinite(code) ? code : undefined
  }
}

/**
 * Misma llamada que hace @afipsdk/afip.js (auth + POST /v1/afip/requests), con fetch.
 * El paquete CommonJS hacía caer la función de Vercel al arrancar.
 */
async function wsfe(
  accessToken: string,
  production: boolean,
  cuit: number,
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const ta = await ticketAcceso(accessToken, production, cuit)
  const res = await fetch('https://app.afipsdk.com/api/v1/afip/requests', {
    method: 'POST',
    headers: sdkHeaders(accessToken, production),
    body: JSON.stringify({
      method,
      params: {
        ...params,
        Auth: { Token: ta.token, Sign: ta.sign, Cuit: cuit }
      },
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
    const error = new Error(mensajeHttp(data, res.status)) as Error & { code?: number }
    if (data && typeof data.code === 'number') error.code = data.code
    throw error
  }
  const result = unwrapAfipResult(method, data)
  const rechazo = rechazoAfip(method, result)
  if (rechazo) {
    const error = new Error(rechazo.message) as Error & { code?: number }
    if (rechazo.code != null) error.code = rechazo.code
    throw error
  }
  return result
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
        const data = await wsfe(accessToken, production, cuit, 'FECompUltimoAutorizado', {
          PtoVta: puntoVenta,
          CbteTipo: cbteTipo
        })
        return Number(data.CbteNro || 0)
      },
      async getVoucherInfo(numero, puntoVenta, cbteTipo) {
        try {
          const data = await wsfe(accessToken, production, cuit, 'FECompConsultar', {
            FeCompConsReq: { CbteNro: numero, PtoVta: puntoVenta, CbteTipo: cbteTipo }
          })
          return data.ResultGet ?? null
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

        const results = await wsfe(accessToken, production, cuit, 'FECAESolicitar', req)
        if (returnResponse) return results
        const detResp = results.FeDetResp as
          | { FECAEDetResponse?: Record<string, unknown> | Record<string, unknown>[] }
          | undefined
        const det = detResp?.FECAEDetResponse
        const first = (Array.isArray(det) ? det[0] : det) || {}
        return { CAE: first.CAE, CAEFchVto: first.CAEFchVto }
      }
    }
  }
}

export function formatNumeroFactura(puntoVenta: number, numeroComprobante: number): string {
  return `${puntoVenta.toString().padStart(4, '0')}-${numeroComprobante.toString().padStart(8, '0')}`
}
