import type { PresupuestoVentaItemRecord, PresupuestoVentaRecord } from '../types/api'
import { formatArgentinaDate } from './dateUtils'
import {
  DEFAULT_AJUSTES_PRECIOS_VENTAS,
  desglosarImporteConAjustes,
  LISTAS_PRECIO_VENTAS,
  normalizarConfigAjustesPrecios,
  totalPorcentajeAjustes,
  type ConfigAjustesPreciosVentas,
  type TipoListaPrecioVentas
} from '../constants/ventasListasPrecio'
import {
  DEFAULT_CONFIG_CONDICIONES_VENTA,
  esPagoMixto
} from '../constants/ventasCondicionesPago'
import { unidadDesdeDescripcionItem } from './unidadPrecio'
import apiService from '../services/api'
import {
  buildPresupuestoPlanillaPdf,
  downloadPresupuestoPlanillaPdf,
  getPresupuestoPlanillaPdfBlob,
  pdfText,
  type PresupuestoPlanillaPayload
} from './presupuestoPlanillaPdf'

function labelsFormasPagoPresupuesto(codigos: string[] | null | undefined): string[] {
  if (!codigos?.length) return []
  const medios = DEFAULT_CONFIG_CONDICIONES_VENTA.medios
  return codigos
    .map((c) => String(c || '').trim())
    .filter((c) => c && !esPagoMixto(c))
    .map((c) => medios.find((m) => m.codigo === c)?.label || c)
}

const EMPRESA_NOMBRE = 'PLOT CENTER S.R.L.'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function labelListaPrecioPdf(tipo: TipoListaPrecioVentas): string {
  const meta = LISTAS_PRECIO_VENTAS[tipo]
  return pdfText(`${meta.label} (${meta.subtitle})`)
}

async function cargarAjustesPrecios(): Promise<ConfigAjustesPreciosVentas> {
  try {
    const res = await apiService.getConfiguracionPreciosVentas()
    if (res.success && res.data) return normalizarConfigAjustesPrecios(res.data)
  } catch {
    /* fallback default */
  }
  return DEFAULT_AJUSTES_PRECIOS_VENTAS
}

async function toPlanillaPayload(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<PresupuestoPlanillaPayload> {
  const fechaCreacion = presupuesto.fecha_creacion
    ? formatArgentinaDate(presupuesto.fecha_creacion)
    : formatArgentinaDate(new Date().toISOString())

  const ajustes = await cargarAjustesPrecios()
  const total = Number(presupuesto.precio_total) || 0
  const desglose = desglosarImporteConAjustes(total, ajustes)
  const pctTotal = totalPorcentajeAjustes(ajustes)
  const factor = pctTotal > 0 ? 1 + pctTotal / 100 : 1
  const mostrarNetoEnLineas = desglose.iva > 0.009

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
    items: items.map((item) => {
      const unit = Number(item.precio_unitario) || 0
      const sub = Number(item.precio_total) || 0
      return {
        codigo: item.codigo_articulo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: unidadDesdeDescripcionItem(item.descripcion) ?? 'm2',
        precio_unitario: mostrarNetoEnLineas ? round2(unit / factor) : unit,
        subtotal: mostrarNetoEnLineas ? round2(sub / factor) : sub
      }
    }),
    total,
    desglose:
      desglose.iva > 0.009 || desglose.recargos.length
        ? {
            neto: desglose.neto,
            iva: desglose.iva,
            iva_porcentaje: desglose.iva_porcentaje,
            recargos: desglose.recargos
          }
        : null,
    notas:
      presupuesto.observaciones_cliente?.trim() ||
      'Precios sujetos a disponibilidad. Este presupuesto no constituye factura.',
    vendedor: presupuesto.nombre_vendedor,
    formas_pago: labelsFormasPagoPresupuesto(presupuesto.formas_pago)
  }
}

/** PDF sobre la planilla oficial /PRESUPUESTO.pdf (misma que chat y /presupuesto). */
export async function buildPresupuestoVentaPDF(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
) {
  return buildPresupuestoPlanillaPdf(await toPlanillaPayload(presupuesto, items))
}

export async function getPresupuestoVentaPdfBlob(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<Blob> {
  return getPresupuestoPlanillaPdfBlob(await toPlanillaPayload(presupuesto, items))
}

export async function descargarPresupuestoVentaPDF(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<void> {
  const nombre = `${presupuesto.numero_presupuesto.replace(/\s+/g, '_')}.pdf`
  await downloadPresupuestoPlanillaPdf(await toPlanillaPayload(presupuesto, items), nombre)
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
