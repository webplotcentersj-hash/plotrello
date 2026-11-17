/**
 * Resumen de facturación para el ERP: ventas que siguen sin comprobante, facturas trabadas
 * en ARCA y totales del mes. Usa las mismas reglas que «Por facturar» (Ventas) y que el
 * detalle de la factura, para que los números coincidan en todas las pantallas.
 */
import apiService from './api'
import { supabase } from './supabaseClient'
import type { FacturaVentaRecord, Venta } from '../types/api'

/** Una venta sin factura más vieja que esto se marca como atrasada. */
export const DIAS_VENTA_ATRASADA = 7

/** Mismo umbral que el servidor y FacturaDetallePage: un "Enviando" más viejo está colgado. */
const ENVIO_AFIP_VENCIDO_MS = 3 * 60 * 1000

export type ProblemaArcaTipo =
  | 'rechazada'
  | 'error'
  | 'colgada'
  | 'sin_cae'
  | 'efectos'
  | 'borrador'
  | 'arca_10016'
  | 'letra_iva'
  | 'red'

/** Cómo actuar desde el resumen: reintentar emisión o ir al detalle a corregir datos. */
export type ProblemaArcaAccionModo = 'reintentar' | 'corregir' | 'efectos'

export type ProblemaArca = {
  tipo: ProblemaArcaTipo
  label: string
  /** Texto del botón para resolverlo. */
  accion: string
  /** Gravedad para ordenar y colorear. */
  nivel: 'danger' | 'warn'
  modo: ProblemaArcaAccionModo
}

type FacturaArcaCampos = Pick<
  FacturaVentaRecord,
  'estado' | 'estado_afip' | 'cae' | 'efectos_aplicados_at' | 'updated_at' | 'resultado_afip'
>

/** Clasifica el texto de resultado_afip (rechazo fiscal vs red vs letra). */
export function clasificarResultadoAfip(resultado: string | null | undefined): 'arca_10016' | 'letra_iva' | 'red' | 'otro' {
  const t = String(resultado || '')
  if (/10016|proximo a autorizar|próximo a autorizar|FECompUltimoAutorizado/i.test(t)) return 'arca_10016'
  if (/comprobante A solo se emite|corresponde comprobante A|Responsables Inscriptos o Monotributistas/i.test(t)) {
    return 'letra_iva'
  }
  if (/fetch failed|operation_failed|Failed to fetch|ECONNRESET|ETIMEDOUT|network|timeout|ABORTED/i.test(t)) {
    return 'red'
  }
  return 'otro'
}

function problemaDesdeResultado(resultado: string | null | undefined): ProblemaArca {
  const clase = clasificarResultadoAfip(resultado)
  if (clase === 'arca_10016') {
    return {
      tipo: 'arca_10016',
      label: 'Fecha/número no correlativo (10016)',
      accion: 'Reintentar ARCA',
      nivel: 'danger',
      modo: 'reintentar'
    }
  }
  if (clase === 'letra_iva') {
    return {
      tipo: 'letra_iva',
      label: 'Condición IVA incompatible',
      accion: 'Ver / corregir',
      nivel: 'danger',
      modo: 'corregir'
    }
  }
  if (clase === 'red') {
    return {
      tipo: 'red',
      label: 'Error de conexión ARCA',
      accion: 'Reintentar ARCA',
      nivel: 'danger',
      modo: 'reintentar'
    }
  }
  return { tipo: 'error', label: 'Error al enviar a ARCA', accion: 'Reintentar ARCA', nivel: 'danger', modo: 'reintentar' }
}

export function problemaArca(f: FacturaArcaCampos): ProblemaArca | null {
  const estado = String(f.estado || '')
  const afip = String(f.estado_afip || '')
  if (estado === 'Anulada' || estado === 'Cancelada') return null
  const autorizada = afip === 'Autorizada'

  if (autorizada) {
    if (estado === 'Emitida' && !f.efectos_aplicados_at) {
      return { tipo: 'efectos', label: 'Falta CxC / asiento', accion: 'Generar CxC / asiento', nivel: 'warn', modo: 'efectos' }
    }
    return null
  }
  if (afip === 'Enviando') {
    const reciente = Date.now() - new Date(f.updated_at || 0).getTime() < ENVIO_AFIP_VENCIDO_MS
    if (reciente) return null
    return { tipo: 'colgada', label: 'Envío a ARCA colgado', accion: 'Reintentar ARCA', nivel: 'danger', modo: 'reintentar' }
  }
  if (afip === 'Rechazada' || afip === 'Error') return problemaDesdeResultado(f.resultado_afip)
  if (estado === 'Emitida') {
    return { tipo: 'sin_cae', label: 'Emitida sin CAE', accion: 'Autorizar ARCA', nivel: 'danger', modo: 'reintentar' }
  }
  if (estado === 'Borrador') {
    return { tipo: 'borrador', label: 'Borrador sin emitir', accion: 'Emitir ARCA', nivel: 'warn', modo: 'reintentar' }
  }
  return null
}

/** Comprobante con validez fiscal (autorizado, o emitido con CAE si estado_afip quedó desfasado). */
export function comprobanteVigente(f: Pick<FacturaVentaRecord, 'estado' | 'estado_afip' | 'cae'>): boolean {
  if (f.estado === 'Anulada' || f.estado === 'Cancelada') return false
  return f.estado_afip === 'Autorizada' || (f.estado === 'Emitida' && String(f.cae || '').trim().length > 0)
}

/** +1 facturas y notas de débito, -1 notas de crédito. */
export function signoComprobante(tipo: string | null | undefined): 1 | -1 {
  return String(tipo || '').startsWith('Nota de Crédito') ? -1 : 1
}

export function letraComprobante(tipo: string | null | undefined): 'A' | 'B' | 'C' | null {
  const m = String(tipo || '').trim().match(/\b([ABC])$/)
  return m ? (m[1] as 'A' | 'B' | 'C') : null
}

export function diasDesde(fecha: string | null | undefined, hoy: string): number {
  const f = String(fecha || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return 0
  return Math.max(0, Math.round((Date.parse(`${hoy}T00:00:00`) - Date.parse(`${f}T00:00:00`)) / 86400000))
}

// ---------------------------------------------------------------------------
// Ventas por facturar
// ---------------------------------------------------------------------------

/** Ventas no canceladas sin factura vigente (misma regla que la pestaña «Por facturar»). */
export async function cargarVentasPorFacturar(): Promise<{ ok: true; ventas: Venta[] } | { ok: false; error: string }> {
  const [ventasRes, facturadasRes] = await Promise.all([
    apiService.obtenerVentas(undefined, undefined, undefined, 'todos'),
    apiService.listIdsVentasFacturadas()
  ])
  if (!ventasRes.success || !ventasRes.data) return { ok: false, error: ventasRes.error || 'No se pudieron cargar las ventas.' }
  if (!facturadasRes.success || !facturadasRes.data) {
    return { ok: false, error: facturadasRes.error || 'No se pudieron cargar las facturas.' }
  }
  const facturadas = new Set(facturadasRes.data.map(Number))
  const ventas = ventasRes.data
    .filter((v) => v.estado_pago !== 'Cancelado' && !facturadas.has(Number(v.id)))
    .sort((a, b) => String(a.fecha_venta || '').localeCompare(String(b.fecha_venta || '')))
  return { ok: true, ventas }
}

export type ResumenPorFacturar = {
  cantidad: number
  monto: number
  atrasadas: number
}

export function resumirPorFacturar(ventas: Venta[], hoy: string): ResumenPorFacturar {
  return {
    cantidad: ventas.length,
    monto: ventas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0),
    atrasadas: ventas.filter((v) => diasDesde(v.fecha_venta, hoy) > DIAS_VENTA_ATRASADA).length
  }
}

// ---------------------------------------------------------------------------
// Facturas con problemas en ARCA
// ---------------------------------------------------------------------------

export type FacturaConProblema = Pick<
  FacturaVentaRecord,
  | 'id'
  | 'numero_factura'
  | 'tipo_comprobante'
  | 'fecha_emision'
  | 'cliente_nombre'
  | 'total'
  | 'estado'
  | 'estado_afip'
  | 'cae'
  | 'efectos_aplicados_at'
  | 'resultado_afip'
  | 'updated_at'
> & { problema: ProblemaArca }

const CAMPOS_PROBLEMA =
  'id,numero_factura,tipo_comprobante,fecha_emision,cliente_nombre,total,estado,estado_afip,cae,efectos_aplicados_at,resultado_afip,updated_at'

export async function cargarFacturasConProblema(): Promise<
  { ok: true; facturas: FacturaConProblema[] } | { ok: false; error: string }
> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' }
  const { data, error } = await supabase
    .from('facturas_venta')
    .select(CAMPOS_PROBLEMA)
    .in('estado', ['Borrador', 'Emitida'])
    .or('estado_afip.is.null,estado_afip.neq.Autorizada,efectos_aplicados_at.is.null')
    .order('fecha_emision', { ascending: false })
    .limit(500)
  if (error) return { ok: false, error: error.message }
  const facturas = ((data || []) as Omit<FacturaConProblema, 'problema'>[])
    .map((f) => ({ ...f, total: Number(f.total) || 0, problema: problemaArca(f) }))
    .filter((f): f is FacturaConProblema => f.problema != null)
    .sort((a, b) => {
      if (a.problema.nivel !== b.problema.nivel) return a.problema.nivel === 'danger' ? -1 : 1
      return String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || ''))
    })
  return { ok: true, facturas }
}

// ---------------------------------------------------------------------------
// Totales del mes
// ---------------------------------------------------------------------------

export type TotalesPeriodo = {
  total: number
  neto: number
  iva: number
  cantidad: number
  porLetra: Record<'A' | 'B' | 'C', { total: number; iva: number; cantidad: number }>
}

function totalesVacios(): TotalesPeriodo {
  return {
    total: 0,
    neto: 0,
    iva: 0,
    cantidad: 0,
    porLetra: { A: { total: 0, iva: 0, cantidad: 0 }, B: { total: 0, iva: 0, cantidad: 0 }, C: { total: 0, iva: 0, cantidad: 0 } }
  }
}

/** Neto = total − IVA. Las notas de crédito restan. */
export function sumarComprobantes(
  facturas: Array<Pick<FacturaVentaRecord, 'tipo_comprobante' | 'estado' | 'estado_afip' | 'cae' | 'total' | 'iva'>>
): TotalesPeriodo {
  const t = totalesVacios()
  for (const f of facturas) {
    if (!comprobanteVigente(f)) continue
    const s = signoComprobante(f.tipo_comprobante)
    const total = (Number(f.total) || 0) * s
    const iva = (Number(f.iva) || 0) * s
    t.total += total
    t.iva += iva
    t.neto += total - iva
    if (String(f.tipo_comprobante || '').startsWith('Factura')) t.cantidad += 1
    const letra = letraComprobante(f.tipo_comprobante)
    if (letra) {
      t.porLetra[letra].total += total
      t.porLetra[letra].iva += iva
      if (String(f.tipo_comprobante || '').startsWith('Factura')) t.porLetra[letra].cantidad += 1
    }
  }
  return t
}

function primerDiaMes(ym: string): string {
  return `${ym}-01`
}

function ultimoDiaMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

export function mesAnterior(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** Totales del mes `ym` y del anterior, para comparar. */
export async function cargarTotalesMes(
  ym: string
): Promise<{ ok: true; actual: TotalesPeriodo; anterior: TotalesPeriodo } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' }
  const prev = mesAnterior(ym)
  const filas: Array<Pick<FacturaVentaRecord, 'tipo_comprobante' | 'estado' | 'estado_afip' | 'cae' | 'total' | 'iva' | 'fecha_emision'>> = []
  const pageSize = 1000
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabase
      .from('facturas_venta')
      .select('tipo_comprobante,estado,estado_afip,cae,total,iva,fecha_emision')
      .gte('fecha_emision', primerDiaMes(prev))
      .lte('fecha_emision', ultimoDiaMes(ym))
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { ok: false, error: error.message }
    const batch = (data || []) as typeof filas
    filas.push(...batch)
    if (batch.length < pageSize) break
  }
  const delMes = (mes: string) => filas.filter((f) => String(f.fecha_emision || '').slice(0, 7) === mes)
  return { ok: true, actual: sumarComprobantes(delMes(ym)), anterior: sumarComprobantes(delMes(prev)) }
}
