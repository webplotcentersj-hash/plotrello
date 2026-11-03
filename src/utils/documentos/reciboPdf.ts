import type { jsPDF } from 'jspdf'
import { guardarBlob } from '../descargarArchivo'
import {
  DocumentoPdf,
  money,
  nombreArchivo,
  type CampoBloque,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type FilaTotal,
  type OpcionesDocumento
} from './kitPdf'
import { montoEnLetras } from './numeroALetras'

/** Recibo X de cobranza: uno por cada cobro registrado de una venta (numeración = id del cobro). */

export type CobroRecibo = {
  id: number
  monto: number
  fecha_pago: string
  metodo_pago?: string | null
  observaciones?: string | null
  usuario_nombre?: string | null
}

export type DatosRecibo = {
  cobro: CobroRecibo
  venta: {
    numero_venta: string
    numero_op?: string | null
    cliente_nombre: string
    cliente_dni_cuit?: string | null
    cliente_direccion?: string | null
    cliente_telefono?: string | null
    valor_total: number
  }
  /** Todos los cobros de la venta: sirve para calcular lo cobrado antes y el saldo. */
  cobros: Array<Pick<CobroRecibo, 'id' | 'monto' | 'fecha_pago'>>
  /** Factura asociada, si ya se emitió (solo informativa). */
  factura?: string | null
}

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function numeroRecibo(idCobro: number, puntoVenta = 1): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(idCobro).padStart(8, '0')}`
}

/** Lo cobrado antes de este cobro (por fecha y, a igual fecha, por orden de carga), este cobro y el saldo. */
export function saldoTrasCobro(
  valorTotal: number,
  cobros: DatosRecibo['cobros'],
  cobro: Pick<CobroRecibo, 'id' | 'monto' | 'fecha_pago'>
): { previos: number; este: number; saldo: number } {
  const dia = (c: { fecha_pago: string }) => String(c.fecha_pago).slice(0, 10)
  const previos = cobros
    .filter((c) => c.id !== cobro.id && (dia(c) < dia(cobro) || (dia(c) === dia(cobro) && c.id < cobro.id)))
    .reduce((s, c) => s + (Number(c.monto) || 0), 0)
  const este = Number(cobro.monto) || 0
  return {
    previos: redondear2(previos),
    este: redondear2(este),
    saldo: Math.max(redondear2((Number(valorTotal) || 0) - previos - este), 0)
  }
}

export function nombreArchivoRecibo(idCobro: number): string {
  return nombreArchivo(`Recibo_X_${numeroRecibo(idCobro)}`)
}

export async function buildReciboPdf(
  datos: DatosRecibo,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<jsPDF> {
  const { cobro, venta } = datos
  const { previos, este, saldo } = saldoTrasCobro(venta.valor_total, datos.cobros, cobro)

  const pdf = await DocumentoPdf.crear(
    {
      titulo: 'Recibo',
      letra: 'X',
      leyendaLetra: 'NO FISCAL',
      numero: numeroRecibo(cobro.id),
      etiquetaNumero: 'Recibo N°',
      fecha: cobro.fecha_pago,
      etiquetaFecha: 'Fecha de cobro',
      sello: 'ORIGINAL',
      pie: 'Recibo X - Documento no válido como factura'
    },
    emisor,
    opciones
  )

  const referencias: CampoBloque[] = [['Venta: ', venta.numero_venta]]
  if (venta.numero_op) referencias.push(['OP: ', venta.numero_op])
  if (datos.factura) referencias.push(['Factura: ', datos.factura])
  pdf.bloque(
    [
      ['Recibimos de: ', venta.cliente_nombre || '-'],
      ['Domicilio: ', venta.cliente_direccion || '-'],
      ['Teléfono: ', venta.cliente_telefono || '-']
    ],
    [['CUIT / DNI: ', venta.cliente_dni_cuit || '-'], ...referencias],
    'Cliente'
  )

  pdf.seccion('La suma de pesos', montoEnLetras(este).toUpperCase())

  const cols: Columna[] = [
    { titulo: 'Concepto', ancho: 150 },
    { titulo: 'Importe', ancho: 40, alinear: 'right' }
  ]
  const concepto = `Cobro de la venta ${venta.numero_venta}${previos > 0 ? ' (pago a cuenta)' : ''}`
  const detalle = [`Forma de pago: ${cobro.metodo_pago || 'No informada'}`, cobro.observaciones].filter(Boolean).join(' - ')
  const filas: FilaTabla[] = [{ celdas: [concepto, money(este)], detalle }]
  pdf.tabla(cols, filas, { colDescripcion: 0 })

  const totales: FilaTotal[] = [
    { label: 'Total de la venta', value: money(venta.valor_total) },
    { label: 'Cobrado anteriormente', value: money(previos) },
    { label: 'Este recibo', value: money(este), fuerte: true },
    { label: saldo > 0 ? 'Saldo pendiente' : 'Saldo', value: saldo > 0 ? money(saldo) : 'Cancelado' }
  ]
  pdf.totales(totales)

  pdf.firmas([`Recibió${cobro.usuario_nombre ? ` - ${cobro.usuario_nombre}` : ' - Plot Center'}`])
  return pdf.finalizar()
}

export async function descargarReciboPdf(
  datos: DatosRecibo,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<void> {
  const doc = await buildReciboPdf(datos, emisor, opciones)
  guardarBlob(doc.output('blob'), nombreArchivoRecibo(datos.cobro.id))
}
