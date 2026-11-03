/** Cómo se arma el PDF de un comprobante ya autorizado (con CAE). */
export type DisenoPdfFactura = 'oficial' | 'plotlab'

export const DISENOS_PDF_FACTURA: Array<{ id: DisenoPdfFactura; label: string; hint: string }> = [
  {
    id: 'oficial',
    label: 'Oficial AfipSDK',
    hint: 'Plantilla estándar de AfipSDK (invoice A/B/C).'
  },
  {
    id: 'plotlab',
    label: 'Diseño Plot Lab',
    hint: 'Logo Plot Center, cantidades decimales e importes en formato argentino.'
  }
]

const STORAGE_KEY = 'plotlab.pdfFacturaDiseno'

export function normalizarDisenoPdfFactura(value: unknown): DisenoPdfFactura {
  return value === 'plotlab' ? 'plotlab' : 'oficial'
}

export function leerDisenoPdfFactura(): DisenoPdfFactura {
  try {
    return normalizarDisenoPdfFactura(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'oficial'
  }
}

export function guardarDisenoPdfFactura(diseno: DisenoPdfFactura): void {
  try {
    localStorage.setItem(STORAGE_KEY, normalizarDisenoPdfFactura(diseno))
  } catch {
    // sin storage (modo privado estricto): se usa solo en esta sesión vía estado React
  }
}
