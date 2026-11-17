/**
 * Datos para Reportes financieros: movimientos de asientos contabilizados, saldos al corte,
 * pendientes de cobro y de pago, y facturas del período. Lecturas livianas y paginadas.
 */
import apiService from './api'
import { supabase } from './supabaseClient'
import type { CuentaPlan, Movimiento, Pendiente, SaldoCuenta, TipoCuenta } from '../features/reportes/estadosContables'

export type Resp<T> = { success: true; data: T } | { success: false; error: string }

const PAGINA = 1000

function cliente() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

async function envolver<T>(fn: () => Promise<T>): Promise<Resp<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
    return { success: false, error: msg }
  }
}

async function paginar<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, tope = 100000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < tope; from += PAGINA) {
    const { data, error } = await consulta(from, from + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = (data ?? []) as T[]
    out.push(...lote)
    if (lote.length < PAGINA) break
  }
  return out
}

type FilaDetalle = {
  debe: number
  haber: number
  cuenta: { codigo: string; nombre: string; tipo: TipoCuenta } | null
  asiento: { fecha: string } | null
}

/** Líneas de asientos contabilizados del rango, una por cuenta. */
export function movimientos(desde: string, hasta: string) {
  return envolver(async () => {
    const filas = await paginar<FilaDetalle>((a, b) =>
      cliente()
        .from('asientos_detalle')
        .select('debe, haber, cuenta:plan_cuentas(codigo, nombre, tipo), asiento:asientos_contables!inner(fecha, estado)')
        .eq('asiento.estado', 'Contabilizado')
        .gte('asiento.fecha', desde)
        .lte('asiento.fecha', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas
      .filter((f) => f.cuenta && f.asiento)
      .map<Movimiento>((f) => ({
        fecha: String(f.asiento!.fecha).slice(0, 10),
        codigo: f.cuenta!.codigo,
        nombre: f.cuenta!.nombre,
        tipo: f.cuenta!.tipo,
        debe: Number(f.debe) || 0,
        haber: Number(f.haber) || 0
      }))
  })
}

/** Saldos acumulados por cuenta al corte (función obtener_balance_general). */
export async function saldosAl(corte: string): Promise<Resp<SaldoCuenta[]>> {
  const r = await apiService.getBalanceGeneral(corte)
  if (!r.success || !r.data) return { success: false, error: r.error || 'No se pudieron leer los saldos' }
  return {
    success: true,
    data: r.data.map((b) => ({
      codigo: String(b.codigo_cuenta),
      nombre: String(b.nombre_cuenta),
      tipo: b.tipo_cuenta as TipoCuenta,
      debe: Number(b.saldo_deudor) || 0,
      haber: Number(b.saldo_acreedor) || 0
    }))
  }
}

export async function planDeCuentas(): Promise<Resp<CuentaPlan[]>> {
  const r = await apiService.getPlanCuentas()
  if (!r.success || !r.data) return { success: false, error: r.error || 'No se pudo leer el plan de cuentas' }
  return { success: true, data: r.data.map((c) => ({ codigo: c.codigo, nombre: c.nombre, tipo: c.tipo as TipoCuenta })) }
}

const ESTADOS_ABIERTOS = ['Pendiente', 'Parcial', 'Vencido']

export function pendientesDeCobro() {
  return envolver(async () => {
    const filas = await paginar<{ cliente_nombre: string; monto_pendiente: number; fecha_vencimiento: string | null; fecha_emision: string }>((a, b) =>
      cliente()
        .from('cuentas_por_cobrar')
        .select('cliente_nombre, monto_pendiente, fecha_vencimiento, fecha_emision')
        .in('estado', ESTADOS_ABIERTOS)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map<Pendiente>((f) => ({
      nombre: f.cliente_nombre || 'Sin nombre',
      pendiente: Number(f.monto_pendiente) || 0,
      vencimiento: f.fecha_vencimiento ? String(f.fecha_vencimiento).slice(0, 10) : null,
      emision: String(f.fecha_emision || '').slice(0, 10)
    }))
  })
}

export function pendientesDePago() {
  return envolver(async () => {
    const filas = await paginar<{ proveedor_nombre: string; monto_pendiente: number; fecha_vencimiento: string | null; fecha_emision: string }>((a, b) =>
      cliente()
        .from('cuentas_por_pagar')
        .select('proveedor_nombre, monto_pendiente, fecha_vencimiento, fecha_emision')
        .in('estado', ESTADOS_ABIERTOS)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map<Pendiente>((f) => ({
      nombre: f.proveedor_nombre || 'Sin nombre',
      pendiente: Number(f.monto_pendiente) || 0,
      vencimiento: f.fecha_vencimiento ? String(f.fecha_vencimiento).slice(0, 10) : null,
      emision: String(f.fecha_emision || '').slice(0, 10)
    }))
  })
}

export type FacturaReporte = {
  fecha_emision: string
  tipo_comprobante: string
  cliente_nombre: string
  total: number
  iva: number
  estado: string
  estado_afip: string | null
  cae: string | null
}

export function facturasDelPeriodo(desde: string, hasta: string) {
  return envolver(async () => {
    const filas = await paginar<FacturaReporte>((a, b) =>
      cliente()
        .from('facturas_venta')
        .select('fecha_emision, tipo_comprobante, cliente_nombre, total, iva, estado, estado_afip, cae')
        .gte('fecha_emision', desde)
        .lte('fecha_emision', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map((f) => ({ ...f, total: Number(f.total) || 0, iva: Number(f.iva) || 0, fecha_emision: String(f.fecha_emision).slice(0, 10) }))
  })
}
