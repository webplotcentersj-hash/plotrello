import type { jsPDF } from 'jspdf'
import {
  esRemitoParcial,
  numeroRemito,
  saldoTrasEntrega,
  type Remito
} from '../../features/remitos/remitosLogica'
import { guardarBlob } from '../descargarArchivo'
import {
  DocumentoPdf,
  cantidadTexto,
  fechaDocumento,
  nombreArchivo,
  type CampoBloque,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type OpcionesDocumento
} from './kitPdf'

export type OpcionesRemitoPdf = OpcionesDocumento & {
  /** Qué entrega es de la venta/OP (1ª, 2ª…), si se conoce. */
  numeroEntrega?: number
}

function conUnidad(n: number, unidad?: string | null): string {
  return `${cantidadTexto(n)}${unidad ? ` ${unidad}` : ''}`
}

export function nombreArchivoRemito(remito: Pick<Remito, 'punto_venta' | 'numero'>): string {
  return nombreArchivo(`Remito_X_${numeroRemito(remito)}`)
}

export async function buildRemitoPdf(
  remito: Remito,
  emisor?: EmisorPdf | null,
  opciones: OpcionesRemitoPdf = {}
): Promise<jsPDF> {
  const anulado = remito.estado === 'Anulado'
  const parcial = !anulado && esRemitoParcial(remito)
  const controlado = remito.items.some((i) => i.cantidad_pedida !== null && i.cantidad_pedida !== undefined)

  const campos: CampoBloque[] = []
  if (opciones.numeroEntrega) campos.push(['Entrega: ', `${parcial ? 'Parcial' : 'Final'} N° ${opciones.numeroEntrega}`])
  else if (parcial) campos.push(['Entrega: ', 'Parcial'])

  const pdf = await DocumentoPdf.crear(
    {
      titulo: 'Remito',
      letra: 'X',
      leyendaLetra: 'NO FISCAL',
      numero: numeroRemito(remito),
      etiquetaNumero: 'Remito N°',
      fecha: remito.fecha_emision,
      campos,
      sello: anulado ? 'ANULADO' : 'ORIGINAL',
      pie: 'Remito X - Documento no válido como factura'
    },
    emisor,
    opciones
  )

  const documento = remito.cliente_documento ? remito.cliente_documento : '-'
  const origen: CampoBloque[] = []
  if (remito.numero_venta) origen.push(['Venta: ', remito.numero_venta])
  if (remito.numero_op) origen.push(['OP: ', remito.numero_op])

  pdf.bloque(
    [
      ['Señor/es: ', remito.cliente_nombre || '-'],
      ['Domicilio: ', remito.cliente_domicilio || '-'],
      ['Teléfono: ', remito.cliente_telefono || '-']
    ],
    [['CUIT / DNI: ', documento], ...origen],
    'Destinatario'
  )

  const entrega: CampoBloque[] = [
    ['Fecha de entrega: ', remito.fecha_entrega ? fechaDocumento(remito.fecha_entrega) : 'A confirmar'],
    ['Retira / recibe: ', remito.entregado_a || '-']
  ]
  const entregaDer: CampoBloque[] = [
    ['DNI de quien retira: ', remito.dni_retira || '-'],
    ['Transporte: ', remito.transportista || 'Retira en local']
  ]
  pdf.bloque(entrega, entregaDer, 'Entrega')

  const cols: Columna[] = controlado
    ? [
        { titulo: '#', ancho: 8, alinear: 'center' },
        { titulo: 'Código', ancho: 20 },
        { titulo: 'Descripción', ancho: 70 },
        { titulo: 'Pedido', ancho: 22, alinear: 'right' },
        { titulo: 'Entregado antes', ancho: 26, alinear: 'right' },
        { titulo: 'Esta entrega', ancho: 22, alinear: 'right' },
        { titulo: 'Saldo', ancho: 22, alinear: 'right' }
      ]
    : [
        { titulo: '#', ancho: 8, alinear: 'center' },
        { titulo: 'Código', ancho: 24 },
        { titulo: 'Descripción', ancho: 118 },
        { titulo: 'Cantidad', ancho: 40, alinear: 'right' }
      ]

  const filas: FilaTabla[] = remito.items.map((it, i) => {
    const base = [String(it.orden || i + 1), it.codigo_articulo || '', it.descripcion]
    if (!controlado) return { celdas: [...base, conUnidad(it.cantidad, it.unidad)], detalle: it.observaciones ?? undefined }
    const libre = it.cantidad_pedida === null || it.cantidad_pedida === undefined
    const saldo = saldoTrasEntrega(it)
    return {
      celdas: [
        ...base,
        libre ? '-' : conUnidad(Number(it.cantidad_pedida), it.unidad),
        libre ? '-' : conUnidad(Number(it.cantidad_previa ?? 0), it.unidad),
        conUnidad(it.cantidad, it.unidad),
        saldo === null ? '-' : conUnidad(saldo, it.unidad)
      ],
      detalle: it.observaciones ?? undefined
    }
  })
  pdf.tabla(cols, filas, { colDescripcion: 2 })

  if (parcial) {
    pdf.seccion('ENTREGA PARCIAL', 'Este remito no completa el pedido: la columna Saldo indica lo que queda por entregar.')
  }
  pdf.seccion('Observaciones', remito.observaciones)
  if (anulado) {
    pdf.seccion(
      'REMITO ANULADO',
      `${remito.anulado_motivo || 'Sin motivo informado'}${remito.anulado_at ? ` (${fechaDocumento(remito.anulado_at.slice(0, 10))})` : ''}`
    )
    pdf.marcaDeAgua('ANULADO')
  }

  pdf.firmas(['Recibí conforme (firma y aclaración)', 'DNI', `Entregó${remito.usuario_nombre ? ` - ${remito.usuario_nombre}` : ' - Plot Center'}`])
  return pdf.finalizar()
}

export async function descargarRemitoPdf(
  remito: Remito,
  emisor?: EmisorPdf | null,
  opciones: OpcionesRemitoPdf = {}
): Promise<void> {
  const doc = await buildRemitoPdf(remito, emisor, opciones)
  guardarBlob(doc.output('blob'), nombreArchivoRemito(remito))
}
