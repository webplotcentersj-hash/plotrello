import type { PresupuestoVentaItemRecord, PresupuestoVentaRecord } from '../types/api'
import { formatArgentinaDate } from './dateUtils'
import { LISTAS_PRECIO_VENTAS, type TipoListaPrecioVentas } from '../constants/ventasListasPrecio'
import {
  buildPresupuestoPlanillaPdf,
  downloadPresupuestoPlanillaPdf,
  getPresupuestoPlanillaPdfBlob,
  pdfText,
  type PresupuestoPlanillaPayload
} from './presupuestoPlanillaPdf'

const EMPRESA_NOMBRE = 'PLOT CENTER S.R.L.'

function labelListaPrecioPdf(tipo: TipoListaPrecioVentas): string {
  const meta = LISTAS_PRECIO_VENTAS[tipo]
  return pdfText(`${meta.label} (${meta.subtitle})`)
}

function toPlanillaPayload(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): PresupuestoPlanillaPayload {
  const fechaCreacion = presupuesto.fecha_creacion
    ? formatArgentinaDate(presupuesto.fecha_creacion)
    : formatArgentinaDate(new Date().toISOString())

  return {
    numero: presupuesto.numero_presupuesto,
    fecha: fechaCreacion,
    validez_hasta: presupuesto.fecha_vencimiento
      ? formatArgentinaDate(presupuesto.fecha_vencimiento)
      : null,
    cliente_nombre: presupuesto.cliente_nombre || '-',
    cliente_empresa: presupuesto.cliente_empresa,
    cliente_dni_cuit: presupuesto.cliente_dni_cuit,
    cliente_telefono: presupuesto.cliente_telefono,
    cliente_email: presupuesto.cliente_email,
    cliente_direccion: presupuesto.cliente_direccion,
    lista_label: presupuesto.tipo_lista_precio
      ? `Lista: ${labelListaPrecioPdf(presupuesto.tipo_lista_precio)}`
      : null,
    items: items.map((item) => ({
      codigo: item.codigo_articulo,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.precio_total
    })),
    total: presupuesto.precio_total || 0,
    notas:
      presupuesto.observaciones_cliente?.trim() ||
      'Los precios pueden variar segun disponibilidad. Este presupuesto no constituye factura.',
    vendedor: presupuesto.nombre_vendedor
  }
}

/** PDF sobre la planilla oficial /PRESUPUESTO.pdf (misma que chat y /presupuesto). */
export async function buildPresupuestoVentaPDF(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
) {
  return buildPresupuestoPlanillaPdf(toPlanillaPayload(presupuesto, items))
}

export async function getPresupuestoVentaPdfBlob(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<Blob> {
  return getPresupuestoPlanillaPdfBlob(toPlanillaPayload(presupuesto, items))
}

export async function descargarPresupuestoVentaPDF(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  const nombre = `${presupuesto.numero_presupuesto.replace(/\s+/g, '_')}.pdf`
  await downloadPresupuestoPlanillaPdf(toPlanillaPayload(presupuesto, items), nombre)
}

function telefonoWhatsapp(tel: string | null | undefined): string | null {
  if (!tel?.trim()) return null
  let d = tel.replace(/\D/g, '')
  if (d.length < 8) return null
  if (d.startsWith('0')) d = d.slice(1)
  if (!d.startsWith('54')) d = `54${d}`
  return d
}

export function mensajePresupuestoVenta(presupuesto: PresupuestoVentaRecord): string {
  const total = (presupuesto.precio_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })
  return (
    `Hola${presupuesto.cliente_nombre ? ` ${presupuesto.cliente_nombre.split(' ')[0]}` : ''}, ` +
    `te enviamos el presupuesto *${presupuesto.numero_presupuesto}* de ${EMPRESA_NOMBRE} ` +
    `por un total de $${total}. ` +
    `Adjuntamos el PDF con el detalle. Cualquier consulta, respondemos por este medio.`
  )
}

export async function enviarPresupuestoPorWhatsapp(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  await descargarPresupuestoVentaPDF(presupuesto, items)
  const tel = telefonoWhatsapp(presupuesto.cliente_telefono)
  const msg = encodeURIComponent(mensajePresupuestoVenta(presupuesto))
  const url = tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function enviarPresupuestoPorEmail(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  await descargarPresupuestoVentaPDF(presupuesto, items)
  const to = presupuesto.cliente_email?.trim() || ''
  const subject = encodeURIComponent(`Presupuesto ${presupuesto.numero_presupuesto} - ${EMPRESA_NOMBRE}`)
  const body = encodeURIComponent(
    `${mensajePresupuestoVenta(presupuesto)}\n\n` +
      'Por favor adjuntá el PDF descargado a este correo antes de enviar.'
  )
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
}
