import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaffSession } from '../../lib/api/staffAuth'
import { autorizarFacturaAfip, buildNumeroFacturaFromAutorizacion } from '../../lib/afip/autorizar'
import { getAfipAccessToken } from '../../lib/afip/client'
import { getSupabaseAdmin, loadAfipConfigResumen } from '../../lib/afip/supabaseAdmin'
import type { AfipConfigResumen, FacturaAfipInput, FacturaReferenciaAfip } from '../../lib/afip/types'

type Body = { id_factura?: number }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  if (!getAfipAccessToken()) {
    res.status(500).json({
      success: false,
      error: 'AFIP_ACCESS_TOKEN no configurado en el servidor (Vercel / .env.local).'
    })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const idFactura = Number(body?.id_factura)
  if (!Number.isFinite(idFactura) || idFactura <= 0) {
    res.status(400).json({ success: false, error: 'id_factura requerido' })
    return
  }

  try {
    const configRow = await loadAfipConfigResumen(supabase)
    const config = configRow as AfipConfigResumen

    const { data: factura, error: errFactura } = await supabase
      .from('facturas_venta')
      .select('*, items:facturas_items(*)')
      .eq('id', idFactura)
      .single()

    if (errFactura || !factura) {
      res.status(404).json({ success: false, error: errFactura?.message || 'Factura no encontrada' })
      return
    }

    if (factura.estado !== 'Emitida') {
      res.status(400).json({ success: false, error: 'Solo se pueden autorizar facturas emitidas' })
      return
    }

    const estadoAfip = String(factura.estado_afip || '')
    if (estadoAfip === 'Autorizada') {
      res.status(400).json({ success: false, error: 'La factura ya está autorizada en AFIP' })
      return
    }

    await supabase
      .from('facturas_venta')
      .update({ estado_afip: 'Enviando', updated_at: new Date().toISOString() })
      .eq('id', idFactura)

    let referencia: FacturaReferenciaAfip = null
    if (factura.id_factura_referencia) {
      const { data: ref } = await supabase
        .from('facturas_venta')
        .select('tipo_comprobante, punto_venta, numero_comprobante')
        .eq('id', factura.id_factura_referencia)
        .maybeSingle()
      if (ref) referencia = ref as FacturaReferenciaAfip
    }

    const facturaInput: FacturaAfipInput = {
      id: factura.id,
      tipo_comprobante: factura.tipo_comprobante,
      punto_venta: factura.punto_venta,
      numero_comprobante: factura.numero_comprobante,
      fecha_emision: factura.fecha_emision,
      cliente_nombre: factura.cliente_nombre,
      cliente_dni_cuit: factura.cliente_dni_cuit,
      cliente_condicion_iva: factura.cliente_condicion_iva,
      subtotal: Number(factura.subtotal),
      iva: Number(factura.iva),
      total: Number(factura.total),
      id_factura_referencia: factura.id_factura_referencia,
      items: (factura.items as FacturaAfipInput['items']) || []
    }

    const auth = await autorizarFacturaAfip(facturaInput, config, referencia)
    const numeroFactura = buildNumeroFacturaFromAutorizacion(auth.puntoVenta, auth.numeroComprobante)
    const now = new Date().toISOString()

    const { data: updated, error: errUpdate } = await supabase
      .from('facturas_venta')
      .update({
        estado_afip: 'Autorizada',
        cae: auth.cae,
        numero_cae: auth.cae,
        fecha_vencimiento_cae: auth.caeVencimiento || null,
        resultado_afip: auth.resultado,
        codigo_resultado_afip: auth.resultado,
        fecha_autorizacion_afip: now,
        punto_venta: auth.puntoVenta,
        numero_comprobante: auth.numeroComprobante,
        numero_factura: numeroFactura,
        updated_at: now
      })
      .eq('id', idFactura)
      .select('*, items:facturas_items(*)')
      .single()

    if (errUpdate) {
      res.status(500).json({
        success: false,
        error: `Autorizado en AFIP (CAE ${auth.cae}) pero falló actualizar BD: ${errUpdate.message}`,
        data: auth
      })
      return
    }

    // Sincronizar último número interno si AFIP asignó uno mayor
    const tipo = String(factura.tipo_comprobante || '')
    const patch: Record<string, number> = {}
    if (tipo.includes(' A')) patch.ultimo_numero_factura_a = auth.numeroComprobante
    else if (tipo.includes(' B')) patch.ultimo_numero_factura_b = auth.numeroComprobante
    else if (tipo.includes(' C')) patch.ultimo_numero_factura_c = auth.numeroComprobante

    if (Object.keys(patch).length && config.id) {
      await supabase.from('configuracion_afip').update(patch).eq('id', config.id)
    }

    res.status(200).json({ success: true, data: updated, afip: auth })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error autorizando en AFIP'
    await supabase
      .from('facturas_venta')
      .update({
        estado_afip: 'Error',
        resultado_afip: message,
        updated_at: new Date().toISOString()
      })
      .eq('id', idFactura)

    res.status(500).json({ success: false, error: message })
  }
}
