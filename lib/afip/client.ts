import Afip from '@afipsdk/afip.js'
import type { AfipAmbiente, AfipConfigResumen } from './types'

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

function parseCuit(value: string | number | undefined | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const digits = String(value || '').replace(/\D/g, '')
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : AFIP_DEV_CUIT
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
  const envCuit = process.env.AFIP_CUIT
  const cuit = envCuit ? parseCuit(envCuit) : parseCuit(config?.cuit)
  const production =
    process.env.AFIP_PRODUCTION === 'true' || isProductionAmbiente(config?.ambiente)

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

  return new Afip(afipOptions)
}

export function formatNumeroFactura(puntoVenta: number, numeroComprobante: number): string {
  return `${puntoVenta.toString().padStart(4, '0')}-${numeroComprobante.toString().padStart(8, '0')}`
}
