import { createRequire } from 'node:module'
import type { AfipAmbiente, AfipConfigResumen } from './types'

/**
 * El SDK es CommonJS. En Vercel (el proyecto es ESM) un `import` estático lo
 * evalúa al cargar el archivo y la función muere con FUNCTION_INVOCATION_FAILED
 * antes de poder responder. Se carga recién al autorizar.
 */
const require = createRequire(import.meta.url)

type AfipCtor = new (options: Record<string, unknown>) => {
  ElectronicBilling: {
    getLastVoucher: (puntoVenta: number, cbteTipo: number) => Promise<number>
    getVoucherInfo: (numero: number, puntoVenta: number, cbteTipo: number) => Promise<unknown>
    createVoucher: (data: Record<string, unknown>, returnResponse?: boolean) => Promise<unknown>
  }
  CUIT?: number
  options?: { production?: boolean }
}

function loadAfip(): AfipCtor {
  const mod = require('@afipsdk/afip.js') as AfipCtor | { default: AfipCtor }
  return (mod as { default?: AfipCtor }).default || (mod as AfipCtor)
}

/** CUIT de prueba AfipSDK (homologación sin certificado propio). */
export const AFIP_DEV_CUIT = 20409378472

export type CreateAfipClientOptions = {
  config?: AfipConfigResumen | null
}

function readPemEnv(value: string | undefined): string | undefined {
  const raw = (value || '').trim()
  if (!raw) return undefined
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

function parseCuit(value: string | number | undefined | null, production: boolean): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const digits = String(value || '').replace(/\D/g, '')
  const n = Number(digits)
  if (digits.length === 11 && Number.isFinite(n)) return n
  if (production) {
    // En producción nunca caer al CUIT de prueba: se facturaría con otro contribuyente
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

export function createAfipClient(options: CreateAfipClientOptions = {}) {
  const accessToken = getAfipAccessToken()
  if (!accessToken) {
    throw new Error(
      'AFIP_ACCESS_TOKEN no configurado. Obtené uno en https://app.afipsdk.com y agregalo a .env.local / Vercel.'
    )
  }

  const config = options.config
  const production =
    process.env.AFIP_PRODUCTION === 'true' || isProductionAmbiente(config?.ambiente)
  const envCuit = process.env.AFIP_CUIT
  const cuit = parseCuit(envCuit || config?.cuit, production)

  const cert = readPemEnv(process.env.AFIP_CERT)
  const key = readPemEnv(process.env.AFIP_KEY)

  const afipOptions: Record<string, unknown> = {
    access_token: accessToken,
    CUIT: cuit,
    production
  }

  if (cert && key) {
    afipOptions.cert = cert
    afipOptions.key = key
  }

  const Afip = loadAfip()
  return new Afip(afipOptions)
}

export function formatNumeroFactura(puntoVenta: number, numeroComprobante: number): string {
  return `${puntoVenta.toString().padStart(4, '0')}-${numeroComprobante.toString().padStart(8, '0')}`
}
