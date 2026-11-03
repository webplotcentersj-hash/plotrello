import type { FacturaVentaRecord } from '../types/api'
import { guardarBlob } from './descargarArchivo'
import type { FacturaPdf } from './facturaAfipPdf'
import { obtenerPdfFactura } from './pdfFactura'
import { buildWhatsappLink } from './whatsappLink'

export type CanalEnvio = 'whatsapp' | 'correo' | 'compartir'
export type ContactoEnvio = { telefono?: string | null; email?: string | null }
export type ResultadoEnvio = { estado: 'compartido' | 'abierto' | 'cancelado'; mensaje: string }

const EMPRESA = 'Plot Center'
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])
const SIGLAS = new Set(['srl', 'sa', 'sas', 'sh', 'sca'])

/** "RODRIGUEZ ALBERTO RUBEN" → "Rodriguez Alberto Ruben". Lo que ya viene en minúsculas no se toca; "Consumidor Final" se omite. */
export function nombreLegible(nombre: string | null | undefined): string {
  const limpio = (nombre || '').trim().replace(/\s+/g, ' ')
  if (!limpio || /^consumidor final$/i.test(limpio)) return ''
  if (limpio !== limpio.toUpperCase()) return limpio
  return limpio
    .toLowerCase()
    .split(' ')
    .map((palabra, i) => {
      if (SIGLAS.has(palabra.replace(/\./g, ''))) return palabra.toUpperCase()
      if (i > 0 && MINUSCULAS.has(palabra)) return palabra
      return palabra.charAt(0).toUpperCase() + palabra.slice(1)
    })
    .join(' ')
}

function monto(n: number): string {
  return `$ ${Math.abs(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function mensajeFactura(factura: FacturaVentaRecord, empresa = EMPRESA): string {
  const nombre = nombreLegible(factura.cliente_nombre)
  return `${nombre ? `Hola ${nombre}` : 'Hola'}, te enviamos tu ${factura.tipo_comprobante} ${factura.numero_factura} por ${monto(factura.total)}. Gracias por elegir ${empresa}.`
}

export function asuntoFactura(factura: FacturaVentaRecord, empresa = EMPRESA): string {
  return `${factura.tipo_comprobante} ${factura.numero_factura} - ${empresa}`
}

export function emailValido(email: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim())
}

export function linkCorreo(email: string, asunto: string, cuerpo: string): string {
  return `mailto:${email.trim()}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}

export function linkWhatsappFactura(factura: FacturaVentaRecord, telefono: string | null | undefined): string | undefined {
  return buildWhatsappLink(telefono, mensajeFactura(factura))
}

/** true si el navegador puede abrir el menú de compartir con un archivo (celulares, Safari, Edge). */
export function puedeCompartirArchivos(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File(['%PDF'], 'factura.pdf', { type: 'application/pdf' })] })
    )
  } catch {
    return false
  }
}

/**
 * Envía el PDF del comprobante. WhatsApp y correo no permiten adjuntar desde un link: se descarga el PDF y se
 * abre la conversación o el mensaje con el texto listo. "Compartir" lo manda directo cuando el navegador puede.
 */
export async function enviarFactura(
  factura: FacturaPdf,
  canal: CanalEnvio,
  contacto: ContactoEnvio = {}
): Promise<ResultadoEnvio> {
  if (canal === 'whatsapp' && !linkWhatsappFactura(factura, contacto.telefono)) {
    throw new Error('Ingresá el teléfono del cliente para abrir WhatsApp.')
  }
  if (canal === 'correo' && !emailValido(contacto.email)) {
    throw new Error('Ingresá un correo válido del cliente.')
  }

  // El navegador solo deja abrir pestañas dentro del clic: se abre antes de generar el PDF y se completa después.
  const ventana = canal === 'whatsapp' ? window.open('about:blank', '_blank') : null
  try {
    const { blob, nombre } = await obtenerPdfFactura(factura)

    if (canal === 'compartir') {
      if (!puedeCompartirArchivos()) {
        guardarBlob(blob, nombre)
        return { estado: 'abierto', mensaje: 'Este navegador no puede compartir archivos: se descargó el PDF.' }
      }
      try {
        await navigator.share({
          files: [new File([blob], nombre, { type: 'application/pdf' })],
          title: asuntoFactura(factura),
          text: mensajeFactura(factura)
        })
        return { estado: 'compartido', mensaje: 'Factura compartida.' }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return { estado: 'cancelado', mensaje: 'Envío cancelado.' }
        if (e instanceof DOMException && e.name === 'NotAllowedError') {
          guardarBlob(blob, nombre)
          return { estado: 'abierto', mensaje: 'No se pudo abrir el menú de compartir: se descargó el PDF.' }
        }
        throw e
      }
    }

    guardarBlob(blob, nombre)
    if (canal === 'whatsapp') {
      const link = linkWhatsappFactura(factura, contacto.telefono) as string
      if (ventana) ventana.location.href = link
      else window.open(link, '_blank')
      return { estado: 'abierto', mensaje: 'Se descargó el PDF y se abrió WhatsApp: adjuntalo en la conversación.' }
    }
    window.location.href = linkCorreo(contacto.email as string, asuntoFactura(factura), mensajeFactura(factura))
    return { estado: 'abierto', mensaje: 'Se descargó el PDF y se abrió tu correo: adjuntalo al mensaje.' }
  } catch (e) {
    ventana?.close()
    throw e
  }
}
