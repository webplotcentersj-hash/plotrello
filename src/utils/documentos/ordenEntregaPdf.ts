import type { jsPDF } from 'jspdf'
import { guardarBlob } from '../descargarArchivo'
import {
  DocumentoPdf,
  cantidadTexto,
  hoyAr,
  money,
  nombreArchivo,
  type CampoBloque,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type OpcionesDocumento
} from './kitPdf'

/**
 * Nota de pedido / orden de entrega: lo que hay que preparar y entregar de una venta, sin precios.
 * Para taller y mostrador; indica si queda saldo por cobrar. No es un remito (no descuenta entregas).
 */

export type DatosOrdenEntrega = {
  venta: {
    numero_venta: string
    numero_op?: string | null
    cliente_nombre: string
    cliente_dni_cuit?: string | null
    cliente_direccion?: string | null
    cliente_telefono?: string | null
    nombre_vendedor?: string | null
    estado_pago?: string | null
    valor_total?: number | null
    monto_pagado?: number | null
    observaciones?: string | null
  }
  items: Array<{ codigo_articulo?: string | null; descripcion: string; cantidad: number; observaciones?: string | null }>
  /** Fecha prometida de entrega, si se conoce. */
  fecha_entrega?: string | null
  /** Fecha del documento; por defecto, hoy. */
  fecha?: string
}

export function nombreArchivoOrdenEntrega(numeroVenta: string): string {
  return nombreArchivo(`Orden_de_entrega_${numeroVenta}`)
}

export async function buildOrdenEntregaPdf(
  datos: DatosOrdenEntrega,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<jsPDF> {
  const { venta } = datos
  const campos: CampoBloque[] = []
  if (datos.fecha_entrega) campos.push(['Entrega: ', datos.fecha_entrega])

  const pdf = await DocumentoPdf.crear(
    {
      titulo: 'Orden de entrega',
      letra: 'X',
      leyendaLetra: 'NO FISCAL',
      numero: venta.numero_venta,
      etiquetaNumero: 'Venta N°',
      fecha: datos.fecha ?? hoyAr(),
      campos,
      sello: 'ORIGINAL',
      pie: 'Orden de entrega - Documento no válido como factura ni como remito'
    },
    emisor,
    opciones
  )

  const referencias: CampoBloque[] = []
  if (venta.numero_op) referencias.push(['OP: ', venta.numero_op])
  if (venta.nombre_vendedor) referencias.push(['Vendedor: ', venta.nombre_vendedor])
  pdf.bloque(
    [
      ['Cliente: ', venta.cliente_nombre || '-'],
      ['Domicilio: ', venta.cliente_direccion || '-'],
      ['Teléfono: ', venta.cliente_telefono || '-']
    ],
    [['CUIT / DNI: ', venta.cliente_dni_cuit || '-'], ...referencias],
    'Entregar a'
  )

  if (venta.valor_total !== undefined && venta.valor_total !== null) {
    const total = Number(venta.valor_total) || 0
    const pagado = Number(venta.monto_pagado ?? 0) || 0
    const saldo = Math.max(Math.round((total - pagado) * 100) / 100, 0)
    pdf.bloque(
      [
        ['Estado de pago: ', venta.estado_pago || '-'],
        ['Total de la venta: ', money(total)]
      ],
      [
        ['Cobrado: ', money(pagado)],
        ['Saldo a cobrar: ', saldo > 0 ? money(saldo) : 'Sin saldo']
      ],
      'Pago'
    )
  }

  const cols: Columna[] = [
    { titulo: '#', ancho: 8, alinear: 'center' },
    { titulo: 'Código', ancho: 26 },
    { titulo: 'Descripción', ancho: 124 },
    { titulo: 'Cantidad', ancho: 32, alinear: 'right' }
  ]
  const filas: FilaTabla[] = datos.items.map((it, i) => ({
    celdas: [String(i + 1), it.codigo_articulo || '', it.descripcion, cantidadTexto(it.cantidad)],
    detalle: it.observaciones || undefined
  }))
  pdf.tabla(cols, filas, { colDescripcion: 2, vacio: 'La venta no tiene líneas cargadas' })

  pdf.seccion('Observaciones', venta.observaciones)
  pdf.firmas(['Autoriza (Plot Center)', 'Recibe (firma, aclaración y DNI)'])
  return pdf.finalizar()
}

export async function descargarOrdenEntregaPdf(
  datos: DatosOrdenEntrega,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<void> {
  const doc = await buildOrdenEntregaPdf(datos, emisor, opciones)
  guardarBlob(doc.output('blob'), nombreArchivoOrdenEntrega(datos.venta.numero_venta))
}
