import { formatFechaAr } from './afipFacturaUi'

/** Estado del certificado de ARCA que informa el servidor (mismo formato que `api/_lib/afip/certificado.ts`). */
export type CertificadoAfipInfo = {
  estado: 'sin_certificado' | 'vigente' | 'por_vencer' | 'vencido' | 'ilegible'
  /** yyyy-mm-dd */
  vence?: string
  /** Días que faltan; negativo si ya venció. */
  dias?: number
  titular?: string
}

export type AvisoCertificado = {
  nivel: 'ok' | 'info' | 'aviso' | 'error'
  texto: string
}

const diasTexto = (n: number) => (n === 1 ? 'falta 1 día' : `faltan ${n} días`)

export function avisoCertificado(info: CertificadoAfipInfo): AvisoCertificado {
  const vence = info.vence ? formatFechaAr(info.vence) : ''
  const dias = info.dias ?? 0
  switch (info.estado) {
    case 'vigente':
      return { nivel: 'ok', texto: `Certificado de ARCA vigente hasta el ${vence} (${diasTexto(dias)}).` }
    case 'por_vencer':
      return {
        nivel: 'aviso',
        texto:
          dias <= 0
            ? `El certificado de ARCA vence hoy (${vence}). Renovalo ya para no dejar de facturar.`
            : `El certificado de ARCA vence el ${vence} (${diasTexto(dias)}). Renovalo antes para no dejar de facturar.`
      }
    case 'vencido':
      return {
        nivel: 'error',
        texto: `El certificado de ARCA venció el ${vence}. No se pueden emitir comprobantes hasta renovarlo.`
      }
    case 'ilegible':
      return { nivel: 'aviso', texto: 'No se pudo leer el certificado del servidor (AFIP_CERT). Revisá que sea un PEM válido.' }
    default:
      return {
        nivel: 'info',
        texto: 'El servidor no tiene un certificado propio en AFIP_CERT, así que no se puede controlar su vencimiento.'
      }
  }
}
