import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireStaffSession } from '../_lib/staffAuth'
import { AfipRechazoError, autorizarFacturaAfip, buildNumeroFacturaFromAutorizacion } from '../../lib/afip/autorizar'
import { getAfipAccessToken } from '../../lib/afip/client'
import { fechaComprobanteParaAfip, normalizarConcepto } from '../../lib/afip/fechas'
import { calcularImportesAfip, FacturaInvalidaError, letraDeTipo } from '../../lib/afip/mapFactura'
import { getSupabaseAdmin, loadAfipConfigResumen } from '../../lib/afip/supabaseAdmin'
import type { AfipConfigResumen, FacturaAfipInput, FacturaReferenciaAfip } from '../../lib/afip/types'

type Body = { id_factura?: number }

/** Un "Enviando" más viejo que esto se considera colgado (la función se cortó) y se puede reintentar. */
const LOCK_VENCIDO_MS = 3 * 60 * 1000
const ESTADOS_AFIP_REINTENTABLES = ['Pendiente', 'Error', 'Rechazada']

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

async function cargarFactura(supabase: SupabaseClient, id: number) {
  const { data, error } = await supabase
    .from('facturas_venta')
    .select('*, items:facturas_items(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, any> | null
}

/** Nota de crédito/débito: el original debe estar autorizado y el crédito no puede superar lo facturado. */
async function validarReferencia(
  supabase: SupabaseClient,
  factura: Record<string, any>
): Promise<FacturaReferenciaAfip> {
  const tipo = String(factura.tipo_comprobante || '')
  if (!tipo.startsWith('Nota de')) return null
  if (!factura.id_factura_referencia) {
    throw new HttpError(400, 'La nota debe referenciar el comprobante original.')
  }

  const { data: ref, error } = await supabase
    .from('facturas_venta')
    .select('id, tipo_comprobante, punto_venta, numero_comprobante, numero_factura, estado_afip, total')
    .eq('id', factura.id_factura_referencia)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!ref) throw new HttpError(400, 'No se encontró el comprobante original de la nota.')
  if (ref.estado_afip !== 'Autorizada') {
    throw new HttpError(400, `El comprobante original ${ref.numero_factura} todavía no está autorizado en AFIP.`)
  }
  if (letraDeTipo(ref.tipo_comprobante) !== letraDeTipo(tipo)) {
    throw new HttpError(400, 'La nota debe tener la misma letra que el comprobante original.')
  }

  if (tipo.startsWith('Nota de Crédito')) {
    const { data: notas, error: errNotas } = await supabase
      .from('facturas_venta')
      .select('tipo_comprobante, total')
      .eq('id_factura_referencia', ref.id)
      .eq('estado_afip', 'Autorizada')
      .neq('id', factura.id)
    if (errNotas) throw new Error(errNotas.message)

    let disponible = Math.abs(Number(ref.total) || 0)
    for (const n of notas || []) {
      const monto = Math.abs(Number(n.total) || 0)
      if (String(n.tipo_comprobante).startsWith('Nota de Crédito')) disponible -= monto
      else if (String(n.tipo_comprobante).startsWith('Nota de Débito')) disponible += monto
    }
    const montoNota = Math.abs(Number(factura.total) || 0)
    if (montoNota > disponible + 0.005) {
      throw new HttpError(
        400,
        `La nota de crédito ($${montoNota.toFixed(2)}) supera el saldo acreditable de ${ref.numero_factura} ($${Math.max(0, disponible).toFixed(2)}).`
      )
    }
  }

  return {
    tipo_comprobante: ref.tipo_comprobante,
    punto_venta: ref.punto_venta,
    numero_comprobante: ref.numero_comprobante
  }
}

/** CxC (o ajuste por nota de crédito) + asiento. Idempotente. Devuelve un aviso si algo quedó pendiente. */
async function aplicarEfectos(supabase: SupabaseClient, idFactura: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('aplicar_efectos_factura', { p_id_factura: idFactura })
  if (error) return `No se generaron la cuenta por cobrar ni el asiento: ${error.message}`
  const asientoError = (data as Record<string, unknown> | null)?.asiento_error
  if (asientoError) return `Cuenta por cobrar generada, pero el asiento quedó pendiente: ${String(asientoError)}`
  return null
}

async function marcarError(supabase: SupabaseClient, idFactura: number, message: string, liberarNumero: boolean) {
  const patch: Record<string, unknown> = {
    estado_afip: 'Error',
    resultado_afip: message,
    updated_at: new Date().toISOString()
  }
  // Solo si AFIP respondió que no: si no hubo respuesta, el número se conserva para verificarlo al reintentar
  if (liberarNumero) patch.afip_numero_intento = null
  await supabase.from('facturas_venta').update(patch).eq('id', idFactura).eq('estado_afip', 'Enviando')
}

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

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  } catch {
    res.status(400).json({ success: false, error: 'JSON inválido' })
    return
  }
  const idFactura = Number(body?.id_factura)
  if (!Number.isFinite(idFactura) || idFactura <= 0) {
    res.status(400).json({ success: false, error: 'id_factura requerido' })
    return
  }

  const { data: puedeEscribir, error: errPermiso } = await supabase.rpc('actor_puede_escribir_comercial', {
    p_actor_id: staff.sub
  })
  if (errPermiso || !puedeEscribir) {
    res.status(403).json({ success: false, error: 'Tu usuario no tiene permiso para emitir comprobantes.' })
    return
  }

  let lockTomado = false
  try {
    const config = (await loadAfipConfigResumen(supabase)) as AfipConfigResumen
    const factura = await cargarFactura(supabase, idFactura)
    if (!factura) throw new HttpError(404, 'Factura no encontrada')

    // Ya tiene CAE: solo completar lo que haya quedado pendiente (CxC / nota de crédito / asiento)
    if (factura.estado_afip === 'Autorizada') {
      if (factura.efectos_aplicados_at) throw new HttpError(400, 'La factura ya está autorizada en AFIP')
      const warning = await aplicarEfectos(supabase, idFactura)
      const actualizada = await cargarFactura(supabase, idFactura)
      if (warning) {
        res.status(500).json({ success: false, error: warning, data: actualizada })
        return
      }
      res.status(200).json({ success: true, data: actualizada })
      return
    }

    if (factura.estado !== 'Borrador' && factura.estado !== 'Emitida') {
      throw new HttpError(400, `No se puede emitir un comprobante en estado ${factura.estado}.`)
    }

    const referencia = await validarReferencia(supabase, factura)

    // Lock atómico: evita que dos clics / pestañas autoricen dos veces el mismo comprobante
    const vencido = new Date(Date.now() - LOCK_VENCIDO_MS).toISOString()
    const { data: lock, error: errLock } = await supabase
      .from('facturas_venta')
      .update({ estado_afip: 'Enviando', updated_at: new Date().toISOString() })
      .eq('id', idFactura)
      .in('estado', ['Borrador', 'Emitida'])
      .or(
        `estado_afip.is.null,estado_afip.in.(${ESTADOS_AFIP_REINTENTABLES.join(',')}),and(estado_afip.eq.Enviando,updated_at.lt."${vencido}")`
      )
      .select('id')
    if (errLock) throw new Error(errLock.message)
    if (!lock?.length) {
      throw new HttpError(409, 'Este comprobante ya se está enviando a AFIP. Esperá unos minutos y recargá.')
    }
    lockTomado = true

    const tipo = String(factura.tipo_comprobante || '')
    const concepto = normalizarConcepto(factura.concepto)
    const facturaInput: FacturaAfipInput = {
      id: factura.id,
      tipo_comprobante: tipo,
      punto_venta: factura.punto_venta,
      numero_comprobante: factura.numero_comprobante,
      fecha_emision: factura.fecha_emision,
      cliente_nombre: factura.cliente_nombre,
      cliente_dni_cuit: factura.cliente_dni_cuit,
      cliente_condicion_iva: factura.cliente_condicion_iva,
      subtotal: Number(factura.subtotal),
      iva: Number(factura.iva),
      total: Number(factura.total),
      concepto,
      fecha_servicio_desde: factura.fecha_servicio_desde,
      fecha_servicio_hasta: factura.fecha_servicio_hasta,
      fecha_vencimiento: factura.fecha_vencimiento,
      id_factura_referencia: factura.id_factura_referencia,
      items: (factura.items as FacturaAfipInput['items']) || []
    }

    const auth = await autorizarFacturaAfip(facturaInput, config, referencia, {
      fechaEmision: fechaComprobanteParaAfip(factura.fecha_emision, concepto),
      numeroIntentoPrevio: factura.afip_numero_intento ?? null,
      reservarNumero: async (numero) => {
        const { error } = await supabase
          .from('facturas_venta')
          .update({ afip_numero_intento: numero })
          .eq('id', idFactura)
        if (error) throw new Error(`No se pudo reservar el número antes de enviar a AFIP: ${error.message}`)
      },
      numeroUsadoPorOtra: async (numero, puntoVenta) => {
        const { data, error } = await supabase
          .from('facturas_venta')
          .select('id')
          .eq('tipo_comprobante', tipo)
          .eq('punto_venta', puntoVenta)
          .eq('numero_comprobante', numero)
          .eq('estado_afip', 'Autorizada')
          .neq('id', idFactura)
          .limit(1)
        if (error) throw new Error(error.message)
        return Boolean(data?.length)
      }
    })

    // Guardar lo que AFIP autorizó (importes recalculados desde los ítems, con signo de nota de crédito)
    const importes = calcularImportesAfip(facturaInput)
    const signo = tipo.startsWith('Nota de Crédito') ? -1 : 1
    const numeroFactura = buildNumeroFacturaFromAutorizacion(auth.puntoVenta, auth.numeroComprobante)
    const now = new Date().toISOString()

    const { error: errUpdate } = await supabase
      .from('facturas_venta')
      .update({
        estado: 'Emitida',
        estado_afip: 'Autorizada',
        cae: auth.cae,
        numero_cae: auth.cae,
        fecha_vencimiento_cae: auth.caeVencimiento || null,
        resultado_afip: auth.observaciones || null,
        codigo_resultado_afip: auth.resultado,
        fecha_autorizacion_afip: now,
        punto_venta: auth.puntoVenta,
        numero_comprobante: auth.numeroComprobante,
        numero_factura: numeroFactura,
        fecha_emision: auth.fechaEmision,
        // Servicios: lo informado a AFIP (el vencimiento del pago también define el de la CxC)
        ...(auth.servicio
          ? {
              fecha_servicio_desde: auth.servicio.desde,
              fecha_servicio_hasta: auth.servicio.hasta,
              fecha_vencimiento: auth.servicio.vtoPago
            }
          : {}),
        subtotal: importes.neto * signo,
        iva: importes.iva * signo,
        total: importes.total * signo,
        updated_at: now
      })
      .eq('id', idFactura)

    if (errUpdate) {
      const message = `AFIP autorizó ${numeroFactura} (CAE ${auth.cae}) pero no se pudo guardar: ${errUpdate.message}. Reintentá: el CAE se recupera sin duplicar.`
      await marcarError(supabase, idFactura, message, false)
      res.status(500).json({ success: false, error: message })
      return
    }

    // Contador solo para la vista previa de facturas (las notas tienen secuencia propia en AFIP)
    if (tipo.startsWith('Factura ') && config.id) {
      const campos = { A: 'ultimo_numero_factura_a', B: 'ultimo_numero_factura_b', C: 'ultimo_numero_factura_c' } as const
      const campo = campos[letraDeTipo(tipo)]
      if (auth.numeroComprobante > Number(config[campo] || 0)) {
        await supabase.from('configuracion_afip').update({ [campo]: auth.numeroComprobante }).eq('id', config.id)
      }
    }

    const warning = await aplicarEfectos(supabase, idFactura)
    const actualizada = await cargarFactura(supabase, idFactura)
    res.status(200).json({
      success: true,
      data: actualizada,
      afip: { cae: auth.cae, numero: numeroFactura, recuperado: Boolean(auth.recuperado) },
      warning: warning || undefined
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error autorizando en AFIP'
    if (lockTomado) {
      // AFIP rechazó explícitamente: el número no se usó. Otro error (red/timeout): se verifica al reintentar.
      await marcarError(supabase, idFactura, message, error instanceof AfipRechazoError)
    }
    const status = error instanceof HttpError ? error.status : error instanceof FacturaInvalidaError ? 400 : 500
    res.status(status).json({ success: false, error: message })
  }
}
