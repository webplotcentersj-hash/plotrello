import { X509Certificate } from 'node:crypto'
import { materialCertificado } from './client'

export type EstadoCertificado = 'sin_certificado' | 'vigente' | 'por_vencer' | 'vencido' | 'ilegible'

export type CertificadoInfo = {
  estado: EstadoCertificado
  /** yyyy-mm-dd (hora de Argentina) en que el certificado deja de ser válido. */
  vence?: string
  /** Días que faltan; negativo si ya venció. */
  dias?: number
  titular?: string
}

/** Desde cuántos días antes del vencimiento se avisa. */
export const DIAS_AVISO_CERTIFICADO = 30

const DIA_MS = 86_400_000

/** Estado de un certificado en formato PEM. Sin PEM no hay nada que controlar. */
export function infoCertificado(pem: string | undefined, ahora: Date = new Date()): CertificadoInfo {
  if (!pem) return { estado: 'sin_certificado' }
  try {
    const cert = new X509Certificate(pem)
    const hasta = new Date(cert.validTo)
    if (Number.isNaN(hasta.getTime())) return { estado: 'ilegible' }
    const dias = Math.floor((hasta.getTime() - ahora.getTime()) / DIA_MS)
    const estado: EstadoCertificado =
      hasta.getTime() <= ahora.getTime() ? 'vencido' : dias <= DIAS_AVISO_CERTIFICADO ? 'por_vencer' : 'vigente'
    return {
      estado,
      vence: hasta.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      dias,
      titular: /CN=([^\n,]+)/.exec(cert.subject)?.[1]?.trim()
    }
  } catch {
    return { estado: 'ilegible' }
  }
}

/** Certificado que el servidor le manda a ARCA (variables AFIP_CERT / AFIPSDK_CERT). */
export function certificadoDelServidor(ahora: Date = new Date()): CertificadoInfo {
  return infoCertificado(materialCertificado().cert, ahora)
}
