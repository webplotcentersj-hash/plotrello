import { buildWsfeVoucherData, tipoComprobanteToCbteTipo } from './mapFactura'
import { createAfipClient, formatNumeroFactura } from './client'
import type { AfipConfigResumen, AutorizarFacturaResult, FacturaAfipInput, FacturaReferenciaAfip } from './types'

/** AFIP respondió y rechazó el comprobante: el número no quedó usado. */
export class AfipRechazoError extends Error {}

function extractAfipError(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'Error desconocido de AFIP'
  const r = raw as Record<string, unknown>
  const det = r.FeDetResp as Record<string, unknown> | undefined
  const detalle = det?.FECAEDetResponse
  const first = Array.isArray(detalle) ? detalle[0] : detalle
  if (first && typeof first === 'object') {
    const obs = (first as Record<string, unknown>).Observaciones as Record<string, unknown> | undefined
    const obsArr = obs?.Obs as unknown
    const o = (Array.isArray(obsArr) ? obsArr[0] : obsArr) as Record<string, unknown> | undefined
    if (o && typeof o === 'object') {
      const code = o.Code != null ? `[${o.Code}] ` : ''
      return `${code}${String(o.Msg || 'Rechazado por AFIP')}`
    }
    const resultado = String((first as Record<string, unknown>).Resultado || '')
    if (resultado === 'R') return 'Comprobante rechazado por AFIP'
  }
  return 'No se pudo autorizar el comprobante en AFIP'
}

/** Observaciones informativas que AFIP puede devolver aun aprobando. */
function extractObservaciones(first: Record<string, unknown> | undefined): string | null {
  const obs = first?.Observaciones as Record<string, unknown> | undefined
  const raw = obs?.Obs as unknown
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Array<Record<string, unknown>>
  const msgs = list.map((o) => `${o.Code != null ? `[${o.Code}] ` : ''}${String(o.Msg || '')}`.trim()).filter(Boolean)
  return msgs.length ? msgs.join(' · ') : null
}

function afipDateToIso(value: unknown): string {
  const s = String(value || '')
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
}

/** Período / vencimiento de servicio tal como quedó informado (del pedido o de la consulta a AFIP). */
function servicioInformado(source: Record<string, unknown>): AutorizarFacturaResult['servicio'] {
  if (!source.FchServDesde || !source.FchServHasta || !source.FchVtoPago) return null
  return {
    desde: afipDateToIso(source.FchServDesde),
    hasta: afipDateToIso(source.FchServHasta),
    vtoPago: afipDateToIso(source.FchVtoPago)
  }
}

export async function testAfipConexion(config: AfipConfigResumen | null) {
  const afip = createAfipClient({ config })
  const ws = afip.ElectronicBilling
  const puntoVenta = Number(config?.punto_venta || 1)
  const cbteTipo = 6 // Factura B — prueba habitual en homologación
  const ultimo = await ws.getLastVoucher(puntoVenta, cbteTipo)
  return {
    ambiente: config?.ambiente || 'Testing',
    puntoVenta,
    cbteTipo,
    ultimoNumero: ultimo,
    cuit: (afip as { CUIT?: number }).CUIT,
    production: Boolean((afip as { options?: { production?: boolean } }).options?.production)
  }
}

export type AutorizarOpciones = {
  /** Fecha a informar (yyyy-mm-dd), ya ajustada al rango que acepta AFIP. */
  fechaEmision: string
  /** Número enviado en un intento anterior que pudo haber llegado a AFIP sin respuesta. */
  numeroIntentoPrevio?: number | null
  /** Se llama antes de enviar: persistir el número permite recuperar el CAE si se corta la respuesta. */
  reservarNumero: (numero: number) => Promise<void>
  /** true si ese número ya figura autorizado para otra factura en la base. */
  numeroUsadoPorOtra: (numero: number, puntoVenta: number) => Promise<boolean>
}

export async function autorizarFacturaAfip(
  factura: FacturaAfipInput,
  config: AfipConfigResumen | null,
  referencia: FacturaReferenciaAfip,
  opts: AutorizarOpciones
): Promise<AutorizarFacturaResult> {
  const puntoVenta = Number(factura.punto_venta || config?.punto_venta || 1)
  const cbteTipo = tipoComprobanteToCbteTipo(factura.tipo_comprobante)

  // Valida datos (letra, CUIT, importes) antes de hablar con AFIP
  const baseData = buildWsfeVoucherData(factura, {
    puntoVenta,
    numeroComprobante: 0,
    fechaEmision: opts.fechaEmision,
    referencia: referencia || undefined,
    condicionEmisor: config?.condicion_iva
  })

  const afip = createAfipClient({ config })
  const ws = afip.ElectronicBilling

  // Un intento anterior pudo haber sido autorizado aunque no llegó la respuesta: recuperarlo en vez de duplicar
  const previo = Number(opts.numeroIntentoPrevio || 0)
  if (previo > 0) {
    const info = (await ws.getVoucherInfo(previo, puntoVenta, cbteTipo)) as Record<string, unknown> | null
    const coincide =
      info &&
      String(info.Resultado || 'A') === 'A' &&
      Boolean(info.CodAutorizacion) &&
      Math.abs(Number(info.ImpTotal) - Number(baseData.ImpTotal)) < 0.005 &&
      Number(info.DocTipo) === Number(baseData.DocTipo) &&
      Number(info.DocNro) === Number(baseData.DocNro)
    if (coincide && !(await opts.numeroUsadoPorOtra(previo, puntoVenta))) {
      return {
        cae: String(info.CodAutorizacion),
        caeVencimiento: afipDateToIso(info.FchVto),
        numeroComprobante: previo,
        puntoVenta,
        fechaEmision: afipDateToIso(info.CbteFch) || opts.fechaEmision,
        servicio: servicioInformado(info),
        resultado: 'A',
        observaciones: 'CAE recuperado de un intento anterior (AFIP ya lo había autorizado).',
        recuperado: true,
        raw: info
      }
    }
  }

  // AFIP es la fuente de verdad de la numeración (cada tipo de comprobante tiene su propia secuencia)
  const numero = Number(await ws.getLastVoucher(puntoVenta, cbteTipo)) + 1
  await opts.reservarNumero(numero)

  let raw: unknown
  try {
    raw = await ws.createVoucher({ ...baseData, CbteDesde: numero, CbteHasta: numero }, true)
  } catch (error) {
    // AfipWebServiceError trae código numérico: AFIP procesó y rechazó
    const code = (error as { code?: unknown })?.code
    if (typeof code === 'number') {
      throw new AfipRechazoError(error instanceof Error ? error.message : 'Rechazado por AFIP')
    }
    throw error
  }

  const det = (raw as Record<string, unknown>)?.FeDetResp as Record<string, unknown> | undefined
  const detalle = det?.FECAEDetResponse
  const first = (Array.isArray(detalle) ? detalle[0] : detalle) as Record<string, unknown> | undefined

  const resultado = String(first?.Resultado || '')
  if (resultado !== 'A') {
    throw new AfipRechazoError(extractAfipError(raw))
  }

  return {
    cae: String(first?.CAE || ''),
    caeVencimiento: afipDateToIso(first?.CAEFchVto),
    numeroComprobante: numero,
    puntoVenta,
    fechaEmision: opts.fechaEmision,
    servicio: servicioInformado(baseData),
    resultado,
    observaciones: extractObservaciones(first),
    raw
  }
}

export function buildNumeroFacturaFromAutorizacion(puntoVenta: number, numeroComprobante: number): string {
  return formatNumeroFactura(puntoVenta, numeroComprobante)
}
