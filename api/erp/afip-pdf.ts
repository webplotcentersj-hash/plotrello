import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaffSession } from '../_lib/staffAuth'
import { getAfipAccessToken } from '../_lib/afip/client'
import {
  buildAfipSdkPdfRequest,
  crearPdfAfipSdk,
  descargarBytesPdfAfip,
  nombreArchivoPdfAfip,
  type AfipPdfEmisor,
  type AfipPdfFactura
} from '../_lib/afip/pdf'
import { getSupabaseAdmin, loadAfipConfigResumen } from '../_lib/afip/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!getAfipAccessToken()) {
    res.status(500).json({
      success: false,
      error: 'AFIPSDK_ACCESS_TOKEN no configurado en el servidor.'
    })
    return
  }
  const staff = requireStaffSession(req, res)
  if (!staff) return

  const id = Number((req.body as { id_factura?: number } | undefined)?.id_factura)
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ success: false, error: 'Falta id_factura.' })
    return
  }

  try {
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      res.status(500).json({ success: false, error: 'Supabase no configurado en el servidor.' })
      return
    }

    const { data: factura, error } = await supabase
      .from('facturas_venta')
      .select('*, items:facturas_items(*)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!factura) {
      res.status(404).json({ success: false, error: 'Factura no encontrada.' })
      return
    }
    if (factura.estado_afip !== 'Autorizada' || !(factura.cae || factura.numero_cae)) {
      res.status(400).json({ success: false, error: 'El comprobante todavía no tiene CAE. El PDF oficial se genera después de autorizar.' })
      return
    }

    let referencia = null
    if (factura.id_factura_referencia) {
      const { data: ref, error: errRef } = await supabase
        .from('facturas_venta')
        .select('tipo_comprobante, punto_venta, numero_comprobante, fecha_emision')
        .eq('id', factura.id_factura_referencia)
        .maybeSingle()
      if (errRef) throw new Error(errRef.message)
      referencia = ref
    }

    const emisor = (await loadAfipConfigResumen(supabase)) as AfipPdfEmisor
    const payload = buildAfipSdkPdfRequest(factura as AfipPdfFactura, emisor, referencia)
    const generado = await crearPdfAfipSdk(payload)
    const bytes = await descargarBytesPdfAfip(generado.file)
    const nombre = generado.file_name || nombreArchivoPdfAfip(factura as AfipPdfFactura)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${nombre.replace(/"/g, '')}"`)
    res.status(200).send(bytes)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo generar el PDF de AfipSDK.'
    })
  }
}
