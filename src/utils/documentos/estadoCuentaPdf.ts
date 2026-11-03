import type { jsPDF } from 'jspdf'
import type { CcPerfilCliente } from '../../types/api'
import { guardarBlob } from '../descargarArchivo'
import {
  DocumentoPdf,
  fechaDocumento,
  hoyAr,
  money,
  nombreArchivo,
  type CampoBloque,
  type Columna,
  type EmisorPdf,
  type FilaTabla,
  type FilaTotal,
  type OpcionesDocumento
} from './kitPdf'

/** Estado de cuenta corriente de un cliente: movimientos con saldo corrido y totales. */

export type MovimientoCuenta = {
  id?: number
  fecha: string
  concepto: string
  tipo?: string | null
  fecha_vencimiento?: string | null
  referencia?: string | null
  debe: number
  haber: number
  saldo_acumulado?: number | null
}

export type DatosEstadoCuenta = {
  cliente: {
    nombre: string
    cuit?: string | null
    condicion_iva?: string | null
    domicilio?: string | null
    email?: string | null
    telefono?: string | null
  }
  resumen: {
    saldo_actual: number
    total_cargos: number
    total_pagos: number
    limite_credito?: number | null
    ultimo_pago_at?: string | null
  }
  movimientos: MovimientoCuenta[]
  /** Fecha del documento; por defecto, hoy. */
  fecha?: string
}

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Ordena por fecha (y por carga a igual fecha) y calcula el saldo corrido. */
export function movimientosConSaldo(movs: MovimientoCuenta[]): Array<MovimientoCuenta & { saldo: number }> {
  const ordenados = movs
    .map((m, i) => ({ m, i }))
    .sort((a, b) => String(a.m.fecha).localeCompare(String(b.m.fecha)) || (a.m.id ?? a.i) - (b.m.id ?? b.i))
    .map(({ m }) => m)
  // Si la base ya trajo el saldo acumulado de todos, se respeta (puede haber un saldo de apertura).
  const traeSaldo = ordenados.length > 0 && ordenados.every((m) => m.saldo_acumulado !== null && m.saldo_acumulado !== undefined)
  let corrido = 0
  return ordenados.map((m) => {
    corrido = redondear2(corrido + (Number(m.debe) || 0) - (Number(m.haber) || 0))
    return { ...m, saldo: traeSaldo ? Number(m.saldo_acumulado) : corrido }
  })
}

/** Arma el estado de cuenta para el cliente a partir del perfil de cuenta corriente (sin datos internos como el score). */
export function datosEstadoCuentaDesdePerfil(
  perfil: CcPerfilCliente,
  nombre: string,
  condicionIva?: string | null
): DatosEstadoCuenta {
  const { ficha, resumen } = perfil
  return {
    cliente: {
      nombre,
      cuit: ficha.cuit,
      condicion_iva: condicionIva ?? ficha.condicion_iva,
      domicilio: [ficha.domicilio, ficha.localidad, ficha.provincia].filter(Boolean).join(', ') || null,
      email: ficha.email,
      telefono: ficha.whatsapp
    },
    resumen: {
      saldo_actual: Number(resumen.saldo_actual) || 0,
      total_cargos: Number(resumen.total_cargos) || 0,
      total_pagos: Number(resumen.total_pagos) || 0,
      limite_credito: resumen.limite_credito ?? null,
      ultimo_pago_at: resumen.ultimo_pago_at ?? null
    },
    movimientos: perfil.movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto,
      tipo: m.tipo,
      fecha_vencimiento: m.fecha_vencimiento ?? null,
      referencia: m.referencia ?? null,
      debe: Number(m.debe) || 0,
      haber: Number(m.haber) || 0,
      saldo_acumulado: m.saldo_acumulado ?? null
    }))
  }
}

export function nombreArchivoEstadoCuenta(cliente: string, fecha: string): string {
  return nombreArchivo(`Estado_de_cuenta_${cliente}_${fecha}`)
}

export async function buildEstadoCuentaPdf(
  datos: DatosEstadoCuenta,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<jsPDF> {
  const fecha = datos.fecha ?? hoyAr()
  const pdf = await DocumentoPdf.crear(
    {
      titulo: 'Estado de cuenta',
      fecha,
      etiquetaFecha: 'Emitido el',
      sello: 'ORIGINAL',
      pie: 'Estado de cuenta - Plot Center S.R.L.'
    },
    emisor,
    opciones
  )

  const { cliente, resumen } = datos
  const derecha: CampoBloque[] = [['CUIT / DNI: ', cliente.cuit || '-'], ['Condición IVA: ', cliente.condicion_iva || '-']]
  if (resumen.limite_credito) derecha.push(['Límite de crédito: ', money(resumen.limite_credito)])
  if (resumen.ultimo_pago_at) derecha.push(['Último pago: ', fechaDocumento(resumen.ultimo_pago_at.slice(0, 10))])
  pdf.bloque(
    [
      ['Cliente: ', cliente.nombre || '-'],
      ['Domicilio: ', cliente.domicilio || '-'],
      ['Contacto: ', [cliente.telefono, cliente.email].filter(Boolean).join(' - ') || '-']
    ],
    derecha,
    'Cliente'
  )

  const cols: Columna[] = [
    { titulo: 'Fecha', ancho: 22 },
    { titulo: 'Concepto', ancho: 72 },
    { titulo: 'Vence', ancho: 22 },
    { titulo: 'Debe', ancho: 24, alinear: 'right' },
    { titulo: 'Haber', ancho: 24, alinear: 'right' },
    { titulo: 'Saldo', ancho: 26, alinear: 'right' }
  ]
  const filas: FilaTabla[] = movimientosConSaldo(datos.movimientos).map((m) => ({
    celdas: [
      fechaDocumento(m.fecha),
      m.concepto,
      m.fecha_vencimiento ? fechaDocumento(m.fecha_vencimiento) : '',
      m.debe ? money(m.debe) : '',
      m.haber ? money(m.haber) : '',
      money(m.saldo)
    ],
    detalle: m.referencia || undefined
  }))
  pdf.tabla(cols, filas, { colDescripcion: 1, vacio: 'Sin movimientos' })

  const saldo = resumen.saldo_actual
  const totales: FilaTotal[] = [
    { label: 'Total cargos', value: money(resumen.total_cargos) },
    { label: 'Total pagos', value: money(resumen.total_pagos) },
    { label: saldo < 0 ? 'SALDO A FAVOR DEL CLIENTE' : 'SALDO A PAGAR', value: money(Math.abs(saldo)), fuerte: true }
  ]
  pdf.totales(totales)
  pdf.seccion('Nota', `Saldo calculado con los movimientos registrados al ${fechaDocumento(fecha)}.`)
  return pdf.finalizar()
}

export async function descargarEstadoCuentaPdf(
  datos: DatosEstadoCuenta,
  emisor?: EmisorPdf | null,
  opciones: OpcionesDocumento = {}
): Promise<void> {
  const fecha = datos.fecha ?? hoyAr()
  const doc = await buildEstadoCuentaPdf({ ...datos, fecha }, emisor, opciones)
  guardarBlob(doc.output('blob'), nombreArchivoEstadoCuenta(datos.cliente.nombre, fecha))
}
