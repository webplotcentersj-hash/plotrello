import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { Venta } from '../types/api'
import {
  inferirCondicionIva,
  inferirTipoFactura,
  validarReceptorComprobante
} from './afipFacturaUi'
import { getArgentinaDateString } from './dateUtils'

export type ResultadoFacturaVenta = {
  ok: boolean
  facturaId?: number
  numero?: string | null
  cae?: string | null
  mensaje: string
}

/** Crea y autoriza la factura AFIP de una venta. Un solo paso, sin formulario. */
export async function emitirFacturaDesdeVenta(venta: Venta): Promise<ResultadoFacturaVenta> {
  if (!supabase) {
    return { ok: false, mensaje: 'No hay conexión para facturar.' }
  }

  const cfg = await apiService.getConfiguracionAFIP()
  if (!cfg.success || !cfg.data) {
    return { ok: false, mensaje: cfg.error || 'Falta la configuración AFIP.' }
  }

  const { data: existente, error: errorExistente } = await supabase
    .from('facturas_venta')
    .select('id, numero_factura, estado_afip, cae')
    .eq('id_venta', venta.id)
    .neq('estado', 'Anulada')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (errorExistente) return { ok: false, mensaje: errorExistente.message }

  if (existente?.estado_afip === 'Autorizada') {
    return {
      ok: true,
      facturaId: existente.id,
      numero: existente.numero_factura,
      cae: existente.cae,
      mensaje: `Esta venta ya tiene la factura ${existente.numero_factura}.`
    }
  }

  const cuit = (venta.cliente_dni_cuit || '').trim()
  const condicion = inferirCondicionIva(cuit)
  const tipo = inferirTipoFactura(cuit, condicion, cfg.data.condicion_iva)
  const errorReceptor = validarReceptorComprobante(tipo, condicion, cuit)
  if (errorReceptor) return { ok: false, mensaje: errorReceptor }

  let facturaId = existente?.id as number | undefined
  if (!facturaId) {
    const itemsRes = await apiService.getItemsVenta(venta.id)
    const crudos = itemsRes.success && itemsRes.data?.length
      ? itemsRes.data
      : [{
          descripcion: `Venta ${venta.numero_venta}${venta.numero_op ? ` · OP ${venta.numero_op}` : ''}`,
          cantidad: 1,
          precio_unitario: Number(venta.valor_total) || 0,
          descuento: 0
        }]
    const items = crudos.filter(
      (item) => item.descripcion?.trim() && Number(item.cantidad) > 0 && Number(item.precio_unitario) > 0
    )
    if (!items.length) {
      return { ok: false, mensaje: 'La venta no tiene ítems con precio para facturar.' }
    }

    const creada = await apiService.crearFactura({
      tipo_comprobante: tipo,
      fecha_emision: getArgentinaDateString(),
      id_cliente: venta.id_cliente ?? null,
      cliente_nombre: (venta.cliente_nombre || '').trim() || 'Consumidor Final',
      cliente_dni_cuit: cuit || null,
      cliente_direccion: venta.cliente_direccion?.trim() || null,
      cliente_condicion_iva: condicion,
      id_op: venta.id_op ?? null,
      numero_op: venta.numero_op ?? null,
      id_venta: venta.id,
      items: items.map((item) => ({
        descripcion: item.descripcion.trim(),
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario),
        descuento: Number(item.descuento) || 0,
        iva_porcentaje: 21
      })),
      precios_con_iva: tipo !== 'Factura C',
      concepto: 1
    })
    if (!creada.success || !creada.data) {
      return { ok: false, mensaje: creada.error || 'No se pudo crear la factura.' }
    }
    facturaId = creada.data.id
  }

  const emit = await apiService.emitirFactura(facturaId)
  if (!emit.success || !emit.data) {
    return {
      ok: false,
      facturaId,
      mensaje: emit.error || 'AFIP no autorizó la factura.'
    }
  }

  const numero = emit.data.numero_factura || emit.data.numero_comprobante
  const cae = emit.data.cae || emit.data.numero_cae
  const extra = emit.warning ? `\n\n${emit.warning}` : ''
  return {
    ok: true,
    facturaId,
    numero,
    cae,
    mensaje: `Factura ${numero || ''} autorizada.${cae ? ` CAE ${cae}.` : ''}${extra}`
  }
}
