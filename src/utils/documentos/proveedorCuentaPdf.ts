import type { jsPDF } from 'jspdf'
import type { MovimientoProveedorEnriquecido } from '../../types/api'
import { etiquetaEstadoVencimiento, type FacturaVencimientoItem } from '../proveedorCuenta'
import { guardarBlob } from '../descargarArchivo'
import {
  DocumentoPdf,
  fechaDocumento,
  hoyAr,
  money,
  nombreArchivo,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type FilaTotal,
  type OpcionesDocumento
} from './kitPdf'
import { descargarEstadoCuentaPdf, type DatosEstadoCuenta } from './estadoCuentaPdf'

/** Estado de cuenta del proveedor (libro con columna Vence). */
export async function descargarCuentaProveedorPdf(input: {
  proveedor: {
    nombre: string
    cuit?: string | null
    condicion_iva?: string | null
    domicilio?: string | null
    email?: string | null
    telefono?: string | null
  }
  saldoActual: number
  totalDebe: number
  totalHaber: number
  movimientos: MovimientoProveedorEnriquecido[]
  fecha?: string
}): Promise<void> {
  const datos: DatosEstadoCuenta = {
    cliente: {
      nombre: input.proveedor.nombre,
      cuit: input.proveedor.cuit,
      condicion_iva: input.proveedor.condicion_iva,
      domicilio: input.proveedor.domicilio,
      email: input.proveedor.email,
      telefono: input.proveedor.telefono
    },
    resumen: {
      saldo_actual: input.saldoActual,
      total_cargos: input.totalDebe,
      total_pagos: input.totalHaber
    },
    movimientos: input.movimientos.map((m) => ({
      id: m.id,
      fecha: String(m.fecha_comprobante || m.fecha_hora || '').slice(0, 10),
      concepto: `${m.tipo_movimiento || 'Movimiento'}${m.comprobante ? ` · ${m.comprobante}` : ''}`,
      tipo: m.tipo_movimiento,
      fecha_vencimiento: m.fecha_vencimiento ? String(m.fecha_vencimiento).slice(0, 10) : null,
      referencia: m.comprobante || null,
      debe: Number(m.debe) || 0,
      haber: Number(m.haber) || 0,
      saldo_acumulado: Number(m.saldo) || 0
    })),
    fecha: input.fecha
  }
  await descargarEstadoCuentaPdf(datos)
}

export function nombreArchivoVencimientosProveedores(fecha: string): string {
  return nombreArchivo(`Vencimientos_proveedores_${fecha}`)
}

/** PDF detallado de facturas vencidas / por vencer (monto + fecha de vto). */
export async function buildVencimientosProveedoresPdf(
  items: FacturaVencimientoItem[],
  opciones: { titulo?: string; nota?: string } = {},
  emisor?: EmisorPdf | null,
  docOpts: OpcionesDocumento = {}
): Promise<jsPDF> {
  const fecha = hoyAr()
  const pdf = await DocumentoPdf.crear(
    {
      titulo: opciones.titulo || 'Vencimientos a proveedores',
      fecha,
      etiquetaFecha: 'Emitido el',
      sello: 'ORIGINAL',
      pie: 'Vencimientos proveedores - Plot Center S.R.L.'
    },
    emisor,
    docOpts
  )

  const vencidas = items.filter((i) => i.estado === 'vencida')
  const proximas = items.filter((i) => i.estado === 'proxima')
  const montoVencidas = vencidas.reduce((s, i) => s + i.monto, 0)
  const montoProximas = proximas.reduce((s, i) => s + i.monto, 0)

  pdf.bloque(
    [
      ['Vencidas: ', `${vencidas.length} · ${money(montoVencidas)}`],
      ['Por vencer (14 días): ', `${proximas.length} · ${money(montoProximas)}`]
    ],
    [['Total alertas: ', `${items.length} · ${money(montoVencidas + montoProximas)}`]],
    'Resumen'
  )

  const cols: Columna[] = [
    { titulo: 'Vto', ancho: 22 },
    { titulo: 'Estado', ancho: 22 },
    { titulo: 'Proveedor', ancho: 58 },
    { titulo: 'Comprobante', ancho: 36 },
    { titulo: 'Importe', ancho: 28, alinear: 'right' },
    { titulo: 'Emisión', ancho: 24 }
  ]
  const filas: FilaTabla[] = items.map((i) => ({
    celdas: [
      fechaDocumento(i.fecha_vencimiento),
      etiquetaEstadoVencimiento(i.estado),
      i.proveedor_nombre,
      i.comprobante,
      money(i.monto),
      i.fecha_comprobante ? fechaDocumento(i.fecha_comprobante) : '—'
    ]
  }))
  pdf.tabla(cols, filas, { colDescripcion: 2, vacio: 'Sin facturas con vencimiento en alerta' })

  const totales: FilaTotal[] = [
    { label: 'Vencidas', value: money(montoVencidas) },
    { label: 'Por vencer', value: money(montoProximas) },
    {
      label: 'TOTAL A ATENDER',
      value: money(montoVencidas + montoProximas),
      fuerte: true
    }
  ]
  pdf.totales(totales)
  pdf.seccion(
    'Nota',
    opciones.nota ||
      `Incluye facturas vencidas y las que vencen en los próximos 14 días al ${fechaDocumento(fecha)}.`
  )
  return pdf.finalizar()
}

export async function descargarVencimientosProveedoresPdf(
  items: FacturaVencimientoItem[],
  opciones?: { titulo?: string; nota?: string },
  emisor?: EmisorPdf | null,
  docOpts: OpcionesDocumento = {}
): Promise<void> {
  const doc = await buildVencimientosProveedoresPdf(items, opciones, emisor, docOpts)
  guardarBlob(doc.output('blob'), nombreArchivoVencimientosProveedores(hoyAr()))
}
