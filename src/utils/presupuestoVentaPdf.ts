import type {
  ArticuloEmpresaRecord,
  PresupuestoVentaItemRecord,
  PresupuestoVentaRecord
} from '../types/api'
import { formatArgentinaDate } from './dateUtils'
import {
  DEFAULT_AJUSTES_PRECIOS_VENTAS,
  desglosarImporteConAjustes,
  LISTAS_PRECIO_VENTAS,
  normalizarConfigAjustesPrecios,
  presupuestoTienePreciosSinIva,
  resolvePrecioLista,
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

function matchCatalogo(
  item: PresupuestoVentaItemRecord,
  catalogo: ArticuloEmpresaRecord[]
): ArticuloEmpresaRecord | undefined {
  if (item.id_articulo_stock) {
    const byStock = catalogo.find((a) => a.id_articulo_stock === item.id_articulo_stock)
    if (byStock) return byStock
  }
  const codigo = (item.codigo_articulo || '').trim().toLowerCase()
  if (codigo) {
    return catalogo.find((a) => (a.codigo || '').trim().toLowerCase() === codigo)
  }
  return undefined
}

/**
 * Cotización correcta = precio de lista con IVA/recargos (igual que el modal).
 * Solo corrige el bug viejo de doble IVA: unit ≈ finalLista × 1.21.
 * No tocar si unit ya coincide con el final de lista (eso era el error del PDF).
 */
function sanearItemsDobleIva(
  items: PresupuestoVentaItemRecord[],
  catalogo: ArticuloEmpresaRecord[],
  tipoLista: TipoListaPrecioVentas,
  ajustes: ConfigAjustesPreciosVentas
): PresupuestoVentaItemRecord[] {
  const ivaPct = ajustes.iva_activo ? ajustes.iva_porcentaje : 0
  if (ivaPct <= 0 || !catalogo.length) return items
  const factor = 1 + ivaPct / 100

  return items.map((item) => {
    const art = matchCatalogo(item, catalogo)
    if (!art) return item
    const finalLista = resolvePrecioLista(art, tipoLista, ajustes)
    if (finalLista == null || finalLista <= 0) return item

    const unit = Number(item.precio_unitario) || 0
    // Precio correcto (con IVA): no tocar.
    const tolOk = Math.max(0.05, finalLista * 0.002)
    if (Math.abs(unit - finalLista) <= tolOk) return item

    const doble = round2(finalLista * factor)
    const tolDoble = Math.max(0.05, doble * 0.002)
    if (Math.abs(unit - doble) > tolDoble) return item

    const cant = Number(item.cantidad) || 0
    const desc = Number(item.descuento) || 0
    return {
      ...item,
      precio_unitario: finalLista,
      precio_total: round2(Math.max(0, cant * finalLista - desc))
    }
  })
}

async function toPlanillaPayload(
  presupuesto: PresupuestoVentaRecord,
  items: PresupuestoVentaItemRecord[]
): Promise<PresupuestoPlanillaPayload> {
  const fechaCreacion = presupuesto.fecha_creacion
    ? formatArgentinaDate(presupuesto.fecha_creacion)
    : formatArgentinaDate(new Date().toISOString())

  const ajustes = await cargarAjustesPrecios()
  const ivaPct = ajustes.iva_activo ? ajustes.iva_porcentaje : 0
  const tipoLista: TipoListaPrecioVentas =
    presupuesto.tipo_lista_precio === 'lista_2' ? 'lista_2' : 'lista_1'

  let catalogo: ArticuloEmpresaRecord[] = []
  try {
    const cat = await apiService.getArticulosEmpresa(undefined, false)
    if (cat.success && cat.data) catalogo = cat.data
  } catch {
    /* sin catálogo: no se puede sanear dobles */
  }

  const preciosSinIva = presupuestoTienePreciosSinIva(presupuesto.observaciones_internas)
  // Con IVA: mismos importes que el modal (lista + IVA/recargos). Solo se corrige doble IVA legado.
  // Sin IVA: importes netos tal cual; no discriminar en el PDF.
  const itemsOk = preciosSinIva
    ? items
    : sanearItemsDobleIva(items, catalogo, tipoLista, ajustes)
  const total = round2(
    itemsOk.reduce((s, it) => s + (Number(it.precio_total) || 0), 0) ||
      Number(presupuesto.precio_total) ||
      0
  )

  // Partir el total (ya con IVA) en neto / IVA para el pie; el TOTAL no cambia.
  const desglose = preciosSinIva
    ? null
    : desglosarImporteConAjustes(total, {
        iva_porcentaje: ivaPct,
        iva_activo: ivaPct > 0,
        // Discriminación solo de IVA; los recargos ya van en el precio de línea.
        recargos: []
      })

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
    items: itemsOk.map((item) => ({
      codigo: item.codigo_articulo,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      unidad: unidadDesdeDescripcionItem(item.descripcion) ?? 'm2',
      // Precio de lista con IVA incluido (tal cual cotizado).
      precio_unitario: Number(item.precio_unitario) || 0,
      subtotal: Number(item.precio_total) || 0
    })),
    total,
    desglose:
      desglose && desglose.iva > 0.009
        ? {
            neto: desglose.neto,
            iva: desglose.iva,
            iva_porcentaje: desglose.iva_porcentaje,
            recargos: []
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
