import { guardarBlob } from './descargarArchivo'
import { generarFacturaAfipPdf, type FacturaPdf } from './facturaAfipPdf'

export type PdfFactura = { blob: Blob; nombre: string }

type Origenes = {
  sdk: (idFactura: number) => Promise<PdfFactura>
  borrador: (factura: FacturaPdf) => Promise<PdfFactura>
}

const ORIGENES: Origenes = {
  // Import dinámico: el servicio del SDK solo se carga cuando hace falta.
  sdk: async (idFactura) => (await import('../services/afipApi')).obtenerPdfFacturaAfip(idFactura),
  borrador: async (factura) => {
    const { doc, nombre } = await generarFacturaAfipPdf(factura)
    return { blob: doc.output('blob'), nombre }
  }
}

/** Los comprobantes autorizados (con CAE) salen del PDF oficial de AfipSDK. */
export function usaPdfDelSdk(factura: Pick<FacturaPdf, 'estado_afip' | 'cae' | 'numero_cae'>): boolean {
  return factura.estado_afip === 'Autorizada' && Boolean(factura.cae || factura.numero_cae)
}

/** PDF de un comprobante: el del SDK si tiene CAE; un borrador no lo tiene, así que se arma localmente. */
export function obtenerPdfFactura(factura: FacturaPdf, origenes: Origenes = ORIGENES): Promise<PdfFactura> {
  return usaPdfDelSdk(factura) ? origenes.sdk(factura.id) : origenes.borrador(factura)
}

export async function descargarPdfFactura(factura: FacturaPdf): Promise<void> {
  const { blob, nombre } = await obtenerPdfFactura(factura)
  guardarBlob(blob, nombre)
}
