import { guardarBlob } from './descargarArchivo'
import {
  leerDisenoPdfFactura,
  normalizarDisenoPdfFactura,
  type DisenoPdfFactura
} from './disenoPdfFactura'
import { generarFacturaAfipPdf, type FacturaPdf } from './facturaAfipPdf'

export type PdfFactura = { blob: Blob; nombre: string }

type Origenes = {
  sdk: (idFactura: number, diseno: DisenoPdfFactura) => Promise<PdfFactura>
  borrador: (factura: FacturaPdf) => Promise<PdfFactura>
}

const ORIGENES: Origenes = {
  // Import dinámico: el servicio del SDK solo se carga cuando hace falta.
  sdk: async (idFactura, diseno) =>
    (await import('../services/afipApi')).obtenerPdfFacturaAfip(idFactura, diseno),
  borrador: async (factura) => {
    const { doc, nombre } = await generarFacturaAfipPdf(factura)
    return { blob: doc.output('blob'), nombre }
  }
}

/** Los comprobantes autorizados (con CAE) salen del PDF de AfipSDK (oficial o diseño Plot Lab). */
export function usaPdfDelSdk(factura: Pick<FacturaPdf, 'estado_afip' | 'cae' | 'numero_cae'>): boolean {
  return factura.estado_afip === 'Autorizada' && Boolean(factura.cae || factura.numero_cae)
}

export type OpcionesPdfFactura = {
  /** Si no se indica, se usa la preferencia guardada (default oficial). */
  diseno?: DisenoPdfFactura
}

/** PDF de un comprobante: el del SDK si tiene CAE; un borrador no lo tiene, así que se arma localmente. */
export function obtenerPdfFactura(
  factura: FacturaPdf,
  origenes: Origenes = ORIGENES,
  opciones: OpcionesPdfFactura = {}
): Promise<PdfFactura> {
  if (!usaPdfDelSdk(factura)) return origenes.borrador(factura)
  const diseno = normalizarDisenoPdfFactura(opciones.diseno ?? leerDisenoPdfFactura())
  return origenes.sdk(factura.id, diseno)
}

export async function descargarPdfFactura(
  factura: FacturaPdf,
  opciones: OpcionesPdfFactura = {}
): Promise<void> {
  const { blob, nombre } = await obtenerPdfFactura(factura, ORIGENES, opciones)
  guardarBlob(blob, nombre)
}
