import { existsSync, readFileSync } from 'node:fs'
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

function digitsCuit(value: string | number | undefined | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const digits = String(Math.trunc(value)).replace(/\D/g, '')
    return digits.length === 11 ? Number(digits) : null
  }
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/**
 * CUIT que firma el comprobante: el de la empresa en Configuración AFIP.
 * No usar el CUIT personal de login ARCA (AFIP_ARCA_USERNAME): ese error 600
 * (“CUIT no apareció en lista de relación”) aparece cuando se manda el CUIT del administrador.
 */
export function resolveCuitEmisor(
  config: AfipConfigResumen | null | undefined,
  production: boolean,
  env: Record<string, string | undefined> = process.env
): number {
  const fromConfig = digitsCuit(config?.cuit)
  if (fromConfig) return fromConfig
  const fromEnv = digitsCuit(env.AFIPSDK_CUIT || env.AFIP_CUIT)
  if (fromEnv) return fromEnv
  if (production) {
    throw new Error('CUIT del emisor inválido o vacío. Revisá Contable → Configuración AFIP o AFIP_CUIT.')
  }
  return AFIP_DEV_CUIT
}

/** Código 600 de AfipSDK: el token no tiene ese CUIT en “relaciones”. */
export function explicarErrorAfip(detalle: string, cuitEmisor?: number): string {
  const texto = (detalle || '').trim()
  const es600 = /\(600\)|Validaci[oó]nDeToken|lista de relaci[oó]n/i.test(texto)
  if (!es600) return texto || 'ARCA rechazó el pedido.'
  const cuitPedido = (texto.match(/(\d{11})/) || [])[1] || ''
  const emisor = cuitEmisor ? String(cuitEmisor) : ''
  if (cuitPedido && emisor && cuitPedido !== emisor) {
    return (
      `ARCA rechazó el token para el CUIT ${cuitPedido}. Ese no es el emisor de Plot Center (${emisor}). ` +
      `En Vercel, AFIP_CUIT tiene que ser el CUIT de la empresa, no el CUIT personal de login ARCA. ` +
      `En app.afipsdk.com, agregá ${emisor} a las relaciones del token.`
    )
  }
  const cuit = cuitPedido || emisor || 'del emisor'
  return (
    `ARCA no tiene el CUIT ${cuit} en las relaciones del token de AfipSDK. ` +
    `En https://app.afipsdk.com abrí el token y agregá el CUIT de Plot Center (el de Configuración AFIP). ` +
    `No uses el CUIT personal con el que entrás a ARCA.`
  )
}

function isProductionAmbiente(ambiente?: AfipAmbiente | string | null): boolean {
  return ambiente === 'Producción'
}

export function getAfipAccessToken(): string {
  return (process.env.AFIPSDK_ACCESS_TOKEN || process.env.AFIP_ACCESS_TOKEN || '').trim()
}

/**
 * PEM real, o nada si la variable es una ruta de archivo.
 * Vercel y dotenv meten `\n` escapadas, líneas vacías o barras. OpenSSL y Afip SDK
 * rechazan eso. Se rearma a líneas de 64 y se tira cualquier carácter que no sea base64.
 */
export function normalizarPem(value: string | undefined): string | undefined {
  if (!value) return undefined
  let raw = value.trim().replace(/^\uFEFF/, '')
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim()
  }
  for (let i = 0; i < 4 && raw.includes('\\n'); i++) raw = raw.replace(/\\n/g, '\n')
  raw = raw.replace(/\\r/g, '')
  const begin = raw.match(/-----BEGIN ([^-]+)-----/)
  const end = raw.match(/-----END ([^-]+)-----/)
  if (!begin || !end) return undefined
  const etiqueta = begin[1].trim()
  if (!etiqueta || etiqueta !== end[1].trim()) return undefined
  const body = raw
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '')
  if (!body) return undefined
  const lines = body.match(/.{1,64}/g) || []
  return `-----BEGIN ${etiqueta}-----\n${lines.join('\n')}\n-----END ${etiqueta}-----\n`
}

const VARS_PEM = [
  'AFIPSDK_CERT_PATH',
  'AFIP_CERT_PATH',
  'AFIPSDK_CERT',
  'AFIP_CERT',
  'AFIPSDK_KEY_PATH',
  'AFIP_KEY_PATH',
  'AFIPSDK_KEY',
  'AFIP_KEY'
] as const

/** Qué variables ve el servidor, sin mostrar el certificado. */
export function resumenVarsPem(): string {
  return VARS_PEM.map((nombre) => {
    const valor = (process.env[nombre] || '').trim()
    if (!valor) return `${nombre} vacía`
    const pintaPem = valor.includes('BEGIN')
    return `${nombre} ${valor.length} caracteres${pintaPem ? '' : ', sin PEM'}`
  }).join(' · ')
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

export function mensajeHttp(data: unknown, status: number, crudo = ''): string {
  const partes: string[] = []
  const walk = (valor: unknown, depth: number) => {
    if (depth > 5 || partes.length >= 6) return
    if (typeof valor === 'string') {
      const texto = valor.trim()
      if (!texto || texto.length > 400 || texto.includes('-----BEGIN')) return
      partes.push(texto)
      return
    }
    if (Array.isArray(valor)) valor.forEach((item) => walk(item, depth + 1))
    else if (valor && typeof valor === 'object') {
      Object.values(valor as Record<string, unknown>).forEach((item) => walk(item, depth + 1))
    }
  }
  walk(data, 0)
  const unico = [...new Set(partes)]
  if (unico.length) return unico.join(' · ')
  const plano = crudo.replace(/\s+/g, ' ').trim()
  if (plano && plano.length < 400 && !plano.includes('-----BEGIN')) return plano
  return `ARCA respondió HTTP ${status}`
}

/** Igual que el ejemplo oficial: si la variable es una ruta, se lee el archivo y se manda el PEM. */
function leerPem(valor: string | undefined): string | undefined {
  const directo = normalizarPem(valor)
  if (directo) return directo
  const ruta = valor?.trim().replace(/^["']|["']$/g, '')
  if (!ruta || ruta.includes('-----BEGIN') || !existsSync(ruta)) return undefined
  return normalizarPem(readFileSync(ruta, 'utf8'))
}

function materialCertificado(): { cert?: string; key?: string } {
  // La guía de Next.js lee el archivo y manda el texto: AFIPSDK_CERT_PATH / AFIPSDK_KEY_PATH.
  const cert =
    leerPem(process.env.AFIPSDK_CERT_PATH) ||
    leerPem(process.env.AFIP_CERT_PATH) ||
    leerPem(process.env.AFIPSDK_CERT) ||
    leerPem(process.env.AFIP_CERT)
  const key =
    leerPem(process.env.AFIPSDK_KEY_PATH) ||
    leerPem(process.env.AFIP_KEY_PATH) ||
    leerPem(process.env.AFIPSDK_KEY) ||
    leerPem(process.env.AFIP_KEY)
  const piezas = [cert, key].filter((item): item is string => Boolean(item))
  return {
    cert: piezas.find((item) => item.includes('CERTIFICATE')),
    key: piezas.find((item) => item.includes('PRIVATE KEY'))
  }
}

/** El SDK pide el ticket (WSAA) y recién después llama al webservice. */
async function ticketAcceso(accessToken: string, production: boolean, cuit: number): Promise<TicketAcceso> {
  const clave = `${production ? 'prod' : 'dev'}:${cuit}`
  const vigente = tickets.get(clave)
  if (vigente && vigente.until > Date.now()) return vigente

  const body: Record<string, unknown> = {
    environment: production ? 'prod' : 'dev',
    wsid: 'wsfe',
    tax_id: String(cuit),
    force_create: false
  }
  const material = materialCertificado()
  if (material.cert && material.key) {
    body.cert = material.cert
    body.key = material.key
  }

  const res = await fetch('https://app.afipsdk.com/api/v1/afip/auth', {
    method: 'POST',
    headers: sdkHeaders(accessToken, production),
    body: JSON.stringify(body)
  })
  const crudo = await res.text()
  const data = (() => {
    try {
      return crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null
    } catch {
      return null
    }
  })()
  if (!res.ok) {
    const detalle = explicarErrorAfip(mensajeHttp(data, res.status, crudo), cuit)
    const faltaPem = !material.cert || !material.key
    throw new Error(
      faltaPem
        ? `${detalle} El servidor no mandó el certificado. ${resumenVarsPem()}`
        : detalle
    )
  }
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

  const crudo = await res.text()
  const data = (() => {
    try {
      return crudo ? (JSON.parse(crudo) as Record<string, unknown>) : null
    } catch {
      return null
    }
  })()
  if (!res.ok) {
    const error = new Error(explicarErrorAfip(mensajeHttp(data, res.status, crudo), cuit)) as Error & {
      code?: number
    }
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
      'AFIPSDK_ACCESS_TOKEN no configurado. Obtené uno en https://app.afipsdk.com y agregalo a Vercel.'
    )
  }

  const config = options.config
  const production = process.env.AFIP_PRODUCTION === 'true' || isProductionAmbiente(config?.ambiente)
  const cuit = resolveCuitEmisor(config, production)

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
