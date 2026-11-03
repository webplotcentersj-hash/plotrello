import type { jsPDF } from 'jspdf'
import { guardarBlob } from '../descargarArchivo'
import {
  DocumentoPdf,
  cantidadTexto,
  fechaDocumento,
  money,
  nombreArchivo,
  type CampoBloque,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type FilaTotal,
  type OpcionesDocumento
} from './kitPdf'

/** Orden de compra para el proveedor, armada desde un pedido de compra aprobado. */

export type DatosOrdenCompra = {
  pedido: {
    numero_pedido: string
    fecha_solicitud: string
    fecha_aprobacion?: string | null
    fecha_entrega_estimada?: string | null
    nombre_solicitante?: string | null
    sector_solicitante?: string | null
    prioridad?: string | null
    motivo?: string | null
    observaciones?: string | null
    nombre_aprobador?: string | null
  }
  proveedor?: {
    nombre: string
    razon_social?: string | null
    cuit?: string | null
    condicion_iva?: string | null
    contacto_nombre?: string | null
    telefono?: string | null
    email?: string | null
    direccion?: string | null
    ciudad?: string | null
    provincia?: string | null
  } | null
  items: Array<{
    codigo_articulo?: string | null
    descripcion: string
    cantidad_solicitada: number
    cantidad_aprobada?: number | null
    unidad?: string | null
    precio_unitario?: number | null
    precio_total?: number | null
    observaciones?: string | null
  }>
}

/** Lo que se le pide al proveedor: la cantidad aprobada si existe, si no la solicitada. */
export function cantidadAPedir(it: DatosOrdenCompra['items'][number]): number {
  const aprobada = it.cantidad_aprobada
  return aprobada !== null && aprobada !== undefined ? Number(aprobada) : Number(it.cantidad_solicitada) || 0
}

function importeLinea(it: DatosOrdenCompra['items'][number]): number | null {
  const unit = it.precio_unitario
  if (unit !== null && unit !== undefined && Number(unit) > 0) return Math.round(cantidadAPedir(it) * Number(unit) * 100) / 100
  if (it.precio_total !== null && it.precio_total !== undefined && Number(it.precio_total) > 0) return Number(it.precio_total)
  return null
}

export function nombreArchivoOrdenCompra(numeroPedido: string): string {
  return nombreArchivo(`Orden_de_compra_${numeroPedido}`)
}

export async function buildOrdenCompraPdf(
  datos: DatosOrdenCompra,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<jsPDF> {
  const { pedido, proveedor } = datos
  const campos: CampoBloque[] = []
  if (pedido.fecha_entrega_estimada) campos.push(['Entrega estimada: ', fechaDocumento(pedido.fecha_entrega_estimada)])
  if (pedido.prioridad && pedido.prioridad !== 'Normal') campos.push(['Prioridad: ', pedido.prioridad])

  const pdf = await DocumentoPdf.crear(
    {
      titulo: 'Orden de compra',
      numero: pedido.numero_pedido,
      etiquetaNumero: 'Orden N°',
      fecha: pedido.fecha_aprobacion || pedido.fecha_solicitud,
      campos,
      sello: 'ORIGINAL',
      pie: 'Orden de compra - Plot Center S.R.L.'
    },
    emisor,
    opciones
  )

  const domicilio = [proveedor?.direccion, proveedor?.ciudad, proveedor?.provincia].filter(Boolean).join(', ')
  pdf.bloque(
    [
      ['Proveedor: ', proveedor ? proveedor.razon_social || proveedor.nombre : 'A definir'],
      ['Domicilio: ', domicilio || '-'],
      ['Contacto: ', [proveedor?.contacto_nombre, proveedor?.telefono].filter(Boolean).join(' - ') || '-']
    ],
    [
      ['CUIT: ', proveedor?.cuit || '-'],
      ['Condición IVA: ', proveedor?.condicion_iva || '-'],
      ['Email: ', proveedor?.email || '-']
    ],
    'Proveedor'
  )
  pdf.bloque(
    [['Solicitó: ', pedido.nombre_solicitante || '-']],
    [['Sector: ', pedido.sector_solicitante || '-']],
    'Pedido interno'
  )

  const importes = datos.items.map(importeLinea)
  const conPrecios = importes.some((i) => i !== null)
  const cols: Columna[] = conPrecios
    ? [
        { titulo: '#', ancho: 8, alinear: 'center' },
        { titulo: 'Código', ancho: 22 },
        { titulo: 'Descripción', ancho: 70 },
        { titulo: 'Cantidad', ancho: 28, alinear: 'right' },
        { titulo: 'Precio unit.', ancho: 30, alinear: 'right' },
        { titulo: 'Importe', ancho: 32, alinear: 'right' }
      ]
    : [
        { titulo: '#', ancho: 8, alinear: 'center' },
        { titulo: 'Código', ancho: 26 },
        { titulo: 'Descripción', ancho: 116 },
        { titulo: 'Cantidad', ancho: 40, alinear: 'right' }
      ]
  const filas: FilaTabla[] = datos.items.map((it, i) => {
    const base = [String(i + 1), it.codigo_articulo || '', it.descripcion]
    const cantidad = `${cantidadTexto(cantidadAPedir(it))}${it.unidad ? ` ${it.unidad}` : ''}`
    const importe = importes[i]
    return {
      celdas: conPrecios
        ? [...base, cantidad, it.precio_unitario ? money(Number(it.precio_unitario)) : '-', importe !== null ? money(importe) : '-']
        : [...base, cantidad],
      detalle: it.observaciones || undefined
    }
  })
  pdf.tabla(cols, filas, { colDescripcion: 2, vacio: 'El pedido no tiene ítems' })

  if (conPrecios) {
    const total = importes.reduce<number>((s, i) => s + (i ?? 0), 0)
    const filasTotal: FilaTotal[] = [{ label: 'TOTAL ESTIMADO', value: money(Math.round(total * 100) / 100), fuerte: true }]
    pdf.totales(filasTotal)
  }
  pdf.seccion('Motivo', pedido.motivo)
  pdf.seccion('Observaciones', pedido.observaciones)
  pdf.firmas([`Autoriza${pedido.nombre_aprobador ? ` - ${pedido.nombre_aprobador}` : ' - Plot Center'}`, 'Conforme proveedor'])
  return pdf.finalizar()
}

export async function descargarOrdenCompraPdf(
  datos: DatosOrdenCompra,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<void> {
  const doc = await buildOrdenCompraPdf(datos, emisor, opciones)
  guardarBlob(doc.output('blob'), nombreArchivoOrdenCompra(datos.pedido.numero_pedido))
}
