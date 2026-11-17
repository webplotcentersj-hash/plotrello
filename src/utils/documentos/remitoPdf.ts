import type { jsPDF } from 'jspdf'
import {
  CODIGO_ARCA_REMITO_R,
  claseDe,
  esRemitoParcial,
  numeroRemito,
  saldoTrasEntrega,
  type Remito
} from '../../features/remitos/remitosLogica'
import { armarCodigoBarrasAfip } from '../codigoBarrasAfip'
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

export function nombreArchivoRemito(remito: Pick<Remito, 'punto_venta' | 'numero'> & { tipo?: Remito['tipo'] }): string {
  return nombreArchivo(`Remito_${remito.tipo === 'R' ? 'R' : 'X'}_${numeroRemito(remito)}`)
}

const TITULO_CLASE = {
  Entrega: 'Remito',
  Devolucion: 'Remito de devolución',
  Traslado: 'Remito de traslado'
} as const

/** 40 dígitos RG 1702 del Remito R, o null si falta algún dato (no frena el PDF). */
export function codigoBarrasRemitoR(remito: Remito, cuitEmisor: string | null | undefined): string | null {
  if (remito.tipo !== 'R' || !remito.cai || !remito.cai_vencimiento || !cuitEmisor) return null
  try {
    return armarCodigoBarrasAfip({
      cuit: cuitEmisor,
      tipoComprobante: CODIGO_ARCA_REMITO_R,
      puntoVenta: remito.punto_venta,
      cae: remito.cai,
      vencimiento: remito.cai_vencimiento
    })
  } catch {
    return null
  }
}

export async function buildRemitoPdf(
  remito: Remito,
  emisor?: EmisorPdf | null,
  opciones: OpcionesRemitoPdf = {}
): Promise<jsPDF> {
  const esR = remito.tipo === 'R'
  const clase = claseDe(remito)
  const anulado = remito.estado === 'Anulado'
  const parcial = !anulado && esRemitoParcial(remito)
  const controlado = clase !== 'Traslado' && remito.items.some((i) => i.cantidad_pedida !== null && i.cantidad_pedida !== undefined)

  const campos: CampoBloque[] = []
  if (clase === 'Entrega') {
    if (opciones.numeroEntrega) campos.push(['Entrega: ', `${parcial ? 'Parcial' : 'Final'} N° ${opciones.numeroEntrega}`])
    else if (parcial) campos.push(['Entrega: ', 'Parcial'])
  } else if (clase === 'Devolucion') {
    campos.push(['Motivo: ', 'Devolución de mercadería'])
  } else {
    campos.push(['Motivo: ', 'Traslado entre depósitos propios'])
  }

  const pdf = await DocumentoPdf.crear(
    {
      titulo: TITULO_CLASE[clase],
      letra: esR ? 'R' : 'X',
      leyendaLetra: esR ? `COD. ${String(CODIGO_ARCA_REMITO_R).padStart(3, '0')}` : 'NO FISCAL',
      numero: numeroRemito(remito),
      etiquetaNumero: 'Remito N°',
      fecha: remito.fecha_emision,
      campos,
      sello: anulado ? 'ANULADO' : 'ORIGINAL',
      pie: esR ? 'Remito R - Documento no válido como factura' : 'Remito X - Documento no válido como factura'
    },
    emisor,
    opciones
  )

  const documento = remito.cliente_documento ? remito.cliente_documento : '-'
  const origen: CampoBloque[] = []
  if (remito.numero_venta) origen.push(['Venta: ', remito.numero_venta])
  if (remito.numero_op) origen.push(['OP: ', remito.numero_op])

  if (clase === 'Traslado') {
    pdf.bloque(
      [
        ['Depósito de origen: ', remito.deposito_origen || '-'],
        ['Depósito de destino: ', remito.deposito_destino || '-']
      ],
      [
        ['Destinatario: ', remito.cliente_nombre || '-'],
        ['CUIT: ', documento]
      ],
      'Traslado'
    )
  } else {
    const derecha: CampoBloque[] = [['CUIT / DNI: ', documento]]
    if (esR || remito.cliente_condicion_iva) derecha.push(['Condición IVA: ', remito.cliente_condicion_iva || '-'])
    pdf.bloque(
      [
        [clase === 'Devolucion' ? 'Devuelve: ' : 'Señor/es: ', remito.cliente_nombre || '-'],
        ['Domicilio: ', remito.cliente_domicilio || '-'],
        ['Teléfono: ', remito.cliente_telefono || '-']
      ],
      [...derecha, ...origen].slice(0, 4),
      clase === 'Devolucion' ? 'Cliente que devuelve' : 'Destinatario'
    )
  }

  const entrega: CampoBloque[] = [
    [
      clase === 'Devolucion' ? 'Fecha de recepción: ' : 'Fecha de entrega: ',
      remito.fecha_entrega ? fechaDocumento(remito.fecha_entrega) : 'A confirmar'
    ],
    [clase === 'Devolucion' ? 'Entrega: ' : 'Retira / recibe: ', remito.entregado_a || '-']
  ]
  if (remito.domicilio_entrega) entrega.push(['Lugar de entrega: ', remito.domicilio_entrega])
  const entregaDer: CampoBloque[] = [
    ['DNI: ', remito.dni_retira || '-'],
    ['Transporte: ', remito.transportista || (clase === 'Entrega' ? 'Retira en local' : '-')]
  ]
  if (remito.transportista_cuit) entregaDer.push(['CUIT transporte: ', remito.transportista_cuit])
  pdf.bloque(entrega, entregaDer, clase === 'Devolucion' ? 'Recepción' : 'Entrega y transporte')

  const colActual = clase === 'Devolucion' ? 'Devuelve' : 'Esta entrega'
  const cols: Columna[] = controlado
    ? [
        { titulo: '#', ancho: 8, alinear: 'center' },
        { titulo: 'Código', ancho: 20 },
        { titulo: 'Descripción', ancho: 70 },
        { titulo: 'Pedido', ancho: 22, alinear: 'right' },
        { titulo: clase === 'Devolucion' ? 'Entregado' : 'Entregado antes', ancho: 26, alinear: 'right' },
        { titulo: colActual, ancho: 22, alinear: 'right' },
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
    const saldo = saldoTrasEntrega(it, clase)
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
  if (clase === 'Devolucion') {
    pdf.seccion('DEVOLUCIÓN', 'La mercadería devuelta vuelve a figurar como pendiente de entrega en la venta / OP.')
  }
  pdf.seccion('Observaciones', remito.observaciones)
  if (anulado) {
    pdf.seccion(
      'REMITO ANULADO',
      `${remito.anulado_motivo || 'Sin motivo informado'}${remito.anulado_at ? ` (${fechaDocumento(remito.anulado_at.slice(0, 10))})` : ''}`
    )
    pdf.marcaDeAgua('ANULADO')
  }

  const firmas =
    clase === 'Devolucion'
      ? ['Entregó (firma y aclaración)', 'DNI', `Recibió${remito.usuario_nombre ? ` - ${remito.usuario_nombre}` : ' - Plot Center'}`]
      : clase === 'Traslado'
        ? ['Despachó (firma y aclaración)', 'Transporte', 'Recibió en destino']
        : ['Recibí conforme (firma y aclaración)', 'DNI', `Entregó${remito.usuario_nombre ? ` - ${remito.usuario_nombre}` : ' - Plot Center'}`]
  pdf.firmas(firmas)

  if (esR && remito.cai && remito.cai_vencimiento) {
    pdf.bloqueCai(remito.cai, remito.cai_vencimiento, codigoBarrasRemitoR(remito, pdf.datosEmisor.cuit))
  }
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
