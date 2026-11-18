/**
 * ERP · Gastos fijos: catálogo de gastos recurrentes y su pago por período.
 * Cada pago (total o parcial) es una fila de erp_gastos (id_gasto_fijo + periodo_fijo);
 * puede haber varios por el mismo período hasta saldar el previsto.
 * Entra en /erp/gastos, balance y reportes como cualquier gasto.
 *
 * Requiere 2026-11-17_erp_gastos_fijos.sql y 2026-11-18_erp_gastos_fijos_pagos_parciales.sql.
 */
import { supabase } from './supabaseClient'

export type ErpResp<T> = { success: true; data: T } | { success: false; error: string }

export const FRECUENCIAS = ['mensual', 'bimestral', 'trimestral', 'semestral', 'anual'] as const
export type Frecuencia = (typeof FRECUENCIAS)[number]

export const FRECUENCIA_LABEL: Record<Frecuencia, string> = {
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual'
}

const MESES_POR_FRECUENCIA: Record<Frecuencia, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12
}

export type GastoFijo = {
  id: number
  concepto: string
  categoria: string | null
  proveedor: string | null
  proveedor_cuit: string | null
  /** Nº de suministro / cliente del servicio (luz, agua, gas…). */
  numero_suministro: string | null
  monto: number
  moneda: string
  frecuencia: Frecuencia
  mes_inicio: string
  mes_fin: string | null
  dia_vencimiento: number
  metodo_pago: string | null
  centro_costo: string | null
  activo: boolean
  observaciones: string | null
}

export type GastoFijoInput = Omit<GastoFijo, 'id'> & { id?: number }

export type PagoGastoFijo = {
  id: number
  id_gasto_fijo: number
  periodo_fijo: string
  fecha_gasto: string
  total: number
  metodo_pago: string | null
}

const PATCH = 'supabase/patches/2026-11-17_erp_gastos_fijos.sql'
const PATCH_PARCIALES = 'supabase/patches/2026-11-18_erp_gastos_fijos_pagos_parciales.sql'

function cliente() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

function mensajeError(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)
  if (/schema cache|does not exist|PGRST20[45]|42P01|42703/i.test(raw) && /gastos_fijos|gasto_fijo|periodo_fijo/i.test(raw)) {
    return `Falta ejecutar ${PATCH} en Supabase.`
  }
  if (/erp_gastos_fijo_periodo_uidx|duplicate key/i.test(raw)) {
    return `No se pudo registrar el pago parcial. Ejecutá ${PATCH_PARCIALES} en Supabase.`
  }
  return raw
}

/** Suma de pagos de un gasto fijo en un período. */
export function totalPagadoPeriodo(pagos: PagoGastoFijo[], idGasto: number, periodo: string): number {
  return pagos
    .filter((p) => Number(p.id_gasto_fijo) === Number(idGasto) && String(p.periodo_fijo) === periodo)
    .reduce((s, p) => s + (Number(p.total) || 0), 0)
}

export function pagosDeGastoPeriodo(pagos: PagoGastoFijo[], idGasto: number, periodo: string): PagoGastoFijo[] {
  return pagos
    .filter((p) => Number(p.id_gasto_fijo) === Number(idGasto) && String(p.periodo_fijo) === periodo)
    .sort((a, b) => String(a.fecha_gasto).localeCompare(String(b.fecha_gasto)) || a.id - b.id)
}

/** Tolerancia de centavos para considerar saldado. */
export function saldoPendienteGasto(previsto: number, pagado: number): number {
  const s = Math.round((Number(previsto) || 0) * 100) / 100 - Math.round((Number(pagado) || 0) * 100) / 100
  return s > 0.009 ? s : 0
}

async function envolver<T>(fn: () => Promise<T>): Promise<ErpResp<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    return { success: false, error: mensajeError(e) }
  }
}

function lanzar(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Lógica de períodos (pura, sin Supabase)
// ---------------------------------------------------------------------------

function mesIndex(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return y * 12 + (m - 1)
}

/** ¿El gasto fijo vence en el período YYYY-MM? */
export function aplicaEnPeriodo(g: Pick<GastoFijo, 'mes_inicio' | 'mes_fin' | 'frecuencia'>, periodo: string): boolean {
  const diff = mesIndex(periodo) - mesIndex(g.mes_inicio)
  if (diff < 0) return false
  if (g.mes_fin && mesIndex(periodo) > mesIndex(g.mes_fin)) return false
  return diff % MESES_POR_FRECUENCIA[g.frecuencia] === 0
}

/** Fecha de vencimiento (YYYY-MM-DD) en el período; si el día no existe usa el último del mes. */
export function vencimientoEnPeriodo(dia: number, periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${periodo}-${String(Math.min(Math.max(dia, 1), ultimo)).padStart(2, '0')}`
}

/** Costo mensual equivalente (un anual de 120.000 = 10.000 por mes). */
export function equivalenteMensual(g: Pick<GastoFijo, 'monto' | 'frecuencia'>): number {
  return (Number(g.monto) || 0) / MESES_POR_FRECUENCIA[g.frecuencia]
}

export function sumarMeses(periodo: string, n: number): string {
  const [y0, m0] = String(periodo || '').split('-').map(Number)
  const y = Number.isFinite(y0) ? y0 : new Date().getFullYear()
  const m = Number.isFinite(m0) && m0 >= 1 && m0 <= 12 ? m0 : 1
  // Date evita el bug de % negativo de JS al restar meses.
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function labelPeriodo(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const txt = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

export function listGastosFijos() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_gastos_fijos').select('*').order('concepto')
    lanzar(error)
    return ((data ?? []) as GastoFijo[]).map((g) => ({
      ...g,
      numero_suministro: g.numero_suministro ? String(g.numero_suministro) : null,
      monto: Number(g.monto) || 0,
      dia_vencimiento: Number(g.dia_vencimiento) || 1
    }))
  })
}

export function guardarGastoFijo(g: GastoFijoInput) {
  return envolver(async () => {
    const { id, ...resto } = g
    const q = id
      ? cliente().from('erp_gastos_fijos').update(resto).eq('id', id)
      : cliente().from('erp_gastos_fijos').insert(resto)
    const { data, error } = await q.select('*').single()
    lanzar(error)
    return data as GastoFijo
  })
}

export function eliminarGastoFijo(id: number) {
  return envolver(async () => {
    // Los pagos ya registrados quedan como gastos comunes (FK ON DELETE SET NULL).
    const { error } = await cliente().from('erp_gastos_fijos').delete().eq('id', id)
    lanzar(error)
    return true
  })
}

/** Pagos registrados para un rango de períodos (inclusive). */
export function listPagosGastosFijos(desde: string, hasta: string) {
  return envolver(async () => {
    const { data, error } = await cliente()
      .from('erp_gastos')
      .select('id,id_gasto_fijo,periodo_fijo,fecha_gasto,total,metodo_pago')
      .not('id_gasto_fijo', 'is', null)
      .gte('periodo_fijo', desde)
      .lte('periodo_fijo', hasta)
    lanzar(error)
    return ((data ?? []) as PagoGastoFijo[]).map((p) => ({
      ...p,
      id: Number(p.id),
      id_gasto_fijo: Number(p.id_gasto_fijo),
      periodo_fijo: String(p.periodo_fijo || ''),
      total: Number(p.total) || 0
    }))
  })
}

export function registrarPagoGastoFijo(
  g: GastoFijo,
  periodo: string,
  pago: {
    fecha: string
    total: number
    metodo_pago: string | null
    observaciones?: string | null
    /** Si el pago no cubre el total del período, se etiqueta como parcial en la descripción. */
    parcial?: boolean
  }
) {
  return envolver(async () => {
    const etiqueta = pago.parcial ? ' · pago parcial' : ''
    const { data, error } = await cliente()
      .from('erp_gastos')
      .insert({
        fecha_gasto: pago.fecha,
        proveedor: g.proveedor,
        proveedor_cuit: g.proveedor_cuit,
        categoria: g.categoria,
        descripcion: `${g.concepto} · ${labelPeriodo(periodo)}${etiqueta}`,
        centro_costo: g.centro_costo,
        total: pago.total,
        moneda: g.moneda || 'ARS',
        metodo_pago: pago.metodo_pago,
        observaciones: pago.observaciones || null,
        origen: 'gasto_fijo',
        id_gasto_fijo: g.id,
        periodo_fijo: periodo
      })
      .select('id,id_gasto_fijo,periodo_fijo,fecha_gasto,total,metodo_pago')
      .single()
    lanzar(error)
    const row = data as PagoGastoFijo
    return {
      ...row,
      id: Number(row.id),
      id_gasto_fijo: Number(row.id_gasto_fijo),
      periodo_fijo: String(row.periodo_fijo || periodo),
      total: Number(row.total) || 0
    }
  })
}

export function anularPagoGastoFijo(idGasto: number) {
  return envolver(async () => {
    const { error } = await cliente().from('erp_gastos').delete().eq('id', idGasto)
    lanzar(error)
    return true
  })
}

export function listCategoriasGastos() {
  return envolver(async () => {
    const { data, error } = await cliente().from('erp_gastos_categorias').select('nombre').order('nombre')
    lanzar(error)
    return ((data ?? []) as Array<{ nombre: string }>).map((r) => r.nombre).filter(Boolean)
  })
}
