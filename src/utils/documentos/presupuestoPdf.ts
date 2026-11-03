import type { jsPDF } from 'jspdf'
import type { PresupuestoPlanillaPayload } from '../presupuestoPlanillaPdf'
import { guardarBlob } from '../descargarArchivo'
import { etiquetaUnidadCorta, unidadDesdeDescripcionItem } from '../unidadPrecio'
import {
  DocumentoPdf,
  cantidadTexto,
  money,
  nombreArchivo,
  type CampoBloque,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type FilaTotal,
  type OpcionesDocumento
} from './kitPdf'

/**
 * Presupuesto en A4 para imprimir o enviar como documento formal. Se arma con los mismos datos que
 * la planilla de marca (PresupuestoPlanillaPayload), así que sirve para el de ventas, el del chat
 * y el del portal sin cambiar nada de cómo se calculan los precios.
 */

function unidadLinea(item: PresupuestoPlanillaPayload['items'][number]): string {
  const id = item.unidad ?? unidadDesdeDescripcionItem(item.descripcion) ?? 'm2'
  return etiquetaUnidadCorta(id)
}

export function nombreArchivoPresupuesto(numero: string): string {
  return nombreArchivo(`Presupuesto_${numero}`)
}

export async function buildPresupuestoA4Pdf(
  presupuesto: PresupuestoPlanillaPayload,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<jsPDF> {
  const campos: CampoBloque[] = []
  if (presupuesto.validez_hasta) campos.push(['Válido hasta: ', presupuesto.validez_hasta])

  const pdf = await DocumentoPdf.crear(
    {
      titulo: 'Presupuesto',
      letra: 'X',
      leyendaLetra: 'NO FISCAL',
      numero: presupuesto.numero,
      etiquetaNumero: 'Presupuesto N°',
      fecha: presupuesto.fecha,
      campos,
      sello: 'ORIGINAL',
      pie: 'Presupuesto - Documento no válido como factura'
    },
    emisor,
    opciones
  )

  const izquierda: CampoBloque[] = [['Cliente: ', presupuesto.cliente_nombre || '-']]
  if (presupuesto.cliente_empresa) izquierda.push(['Empresa: ', presupuesto.cliente_empresa])
  izquierda.push(['Domicilio: ', presupuesto.cliente_direccion || '-'])
  izquierda.push(['Email: ', presupuesto.cliente_email || '-'])
  const derecha: CampoBloque[] = [
    ['CUIT / DNI: ', presupuesto.cliente_dni_cuit || '-'],
    ['Teléfono: ', presupuesto.cliente_telefono || '-']
  ]
  if (presupuesto.lista_label) derecha.push(['Lista de precios: ', presupuesto.lista_label.replace(/^Lista:\s*/, '')])
  if (presupuesto.vendedor) derecha.push(['Vendedor: ', presupuesto.vendedor])
  pdf.bloque(izquierda, derecha, 'Cliente')

  const cols: Columna[] = [
    { titulo: '#', ancho: 8, alinear: 'center' },
    { titulo: 'Código', ancho: 22 },
    { titulo: 'Descripción', ancho: 76 },
    { titulo: 'Cantidad', ancho: 24, alinear: 'right' },
    { titulo: 'Precio unit.', ancho: 28, alinear: 'right' },
    { titulo: 'Subtotal', ancho: 32, alinear: 'right' }
  ]
  const filas: FilaTabla[] = presupuesto.items.map((it, i) => ({
    celdas: [
      String(i + 1),
      it.codigo || '',
      it.descripcion,
      `${cantidadTexto(it.cantidad)} ${unidadLinea(it)}`,
      money(it.precio_unitario),
      money(it.subtotal)
    ]
  }))
  pdf.tabla(cols, filas, { colDescripcion: 2, vacio: 'Sin ítems' })

  const totales: FilaTotal[] = []
  const d = presupuesto.desglose
  const mostrarIva = Boolean(d && d.iva > 0.009)
  const recargos = (d?.recargos ?? []).filter((r) => r.monto > 0.009)
  if (d && (mostrarIva || recargos.length)) {
    totales.push({ label: 'Subtotal (neto)', value: money(d.neto) })
    for (const r of recargos) totales.push({ label: `${r.nombre} ${cantidadTexto(r.porcentaje)}%`, value: money(r.monto) })
    if (mostrarIva) totales.push({ label: `IVA ${cantidadTexto(d.iva_porcentaje)}%`, value: money(d.iva) })
  }
  totales.push({ label: 'TOTAL', value: money(presupuesto.total), fuerte: true })
  pdf.totales(totales)

  if (presupuesto.formas_pago?.length) pdf.seccion('Formas de pago', presupuesto.formas_pago.join('  -  '))
  pdf.seccion('Observaciones', presupuesto.notas)
  pdf.firmas(['Conforme del cliente (firma y aclaración)', `Plot Center${presupuesto.vendedor ? ` - ${presupuesto.vendedor}` : ''}`])
  return pdf.finalizar()
}

export async function descargarPresupuestoA4Pdf(
  presupuesto: PresupuestoPlanillaPayload,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<void> {
  const doc = await buildPresupuestoA4Pdf(presupuesto, emisor, opciones)
  guardarBlob(doc.output('blob'), nombreArchivoPresupuesto(presupuesto.numero))
}
