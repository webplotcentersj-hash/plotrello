/**
 * Lecturas para Balance económico: ventas (incl. CC), gastos, pagos a proveedores y egresos de caja.
 */
import { supabase } from './supabaseClient'
import type {
  EgresoCajaEco,
  GastoEco,
  LiquidacionEmpleadoEco,
  PagoProveedorEco,
  VentaEco
} from '../features/reportes/balanceEconomico'

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
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e)
    return { success: false, error: msg }
  }
}

async function paginar<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  tope = 100000
): Promise<T[]> {
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

export function ventasDelPeriodo(desde: string, hasta: string) {
  return envolver(async () => {
    type Fila = {
      fecha_venta: string
      valor_total: number
      monto_pagado: number | null
      metodo_pago: string | null
      estado_pago: string | null
      cliente_nombre: string | null
      cliente_empresa: string | null
    }
    const filas = await paginar<Fila>((a, b) =>
      cliente()
        .from('ventas')
        .select('fecha_venta, valor_total, monto_pagado, metodo_pago, estado_pago, cliente_nombre, cliente_empresa')
        .gte('fecha_venta', desde)
        .lte('fecha_venta', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map<VentaEco>((f) => ({
      fecha: String(f.fecha_venta || '').slice(0, 10),
      valor_total: Number(f.valor_total) || 0,
      monto_pagado: Number(f.monto_pagado) || 0,
      metodo_pago: f.metodo_pago,
      estado_pago: f.estado_pago,
      cliente: (f.cliente_empresa || f.cliente_nombre || 'Sin nombre').trim() || 'Sin nombre'
    }))
  })
}

export function gastosDelPeriodo(desde: string, hasta: string) {
  return envolver(async () => {
    type Fila = {
      fecha_gasto: string
      total: number
      categoria: string | null
      descripcion: string | null
      id_gasto_fijo: number | null
      origen: string | null
    }
    const filas = await paginar<Fila>((a, b) =>
      cliente()
        .from('erp_gastos')
        .select('fecha_gasto, total, categoria, descripcion, id_gasto_fijo, origen')
        .gte('fecha_gasto', desde)
        .lte('fecha_gasto', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map<GastoEco>((f) => ({
      fecha: String(f.fecha_gasto || '').slice(0, 10),
      total: Number(f.total) || 0,
      categoria: f.categoria,
      descripcion: f.descripcion,
      id_gasto_fijo: f.id_gasto_fijo == null ? null : Number(f.id_gasto_fijo),
      origen: f.origen
    }))
  })
}

export function pagosProveedoresDelPeriodo(desde: string, hasta: string) {
  return envolver(async () => {
    type Fila = { fecha: string; monto: number; proveedor_nombre: string | null }
    const filas = await paginar<Fila>((a, b) =>
      cliente()
        .from('pagos_proveedores')
        .select('fecha, monto, proveedor_nombre')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map<PagoProveedorEco>((f) => ({
      fecha: String(f.fecha || '').slice(0, 10),
      monto: Number(f.monto) || 0,
      proveedor: (f.proveedor_nombre || 'Proveedor').trim() || 'Proveedor'
    }))
  })
}

/** Egresos de caja: movimientos tipo egreso no anulados. */
export function egresosCajaDelPeriodo(desde: string, hasta: string) {
  return envolver(async () => {
    type Fila = {
      fecha: string
      monto_total: number | null
      concepto: string | null
      anulado: boolean | null
      tipo_movimiento: string | null
    }
    const filas = await paginar<Fila>((a, b) =>
      cliente()
        .from('control_caja_movimientos')
        .select('fecha, monto_total, concepto, anulado, tipo_movimiento')
        .eq('tipo_movimiento', 'egreso')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas
      .filter((f) => !f.anulado)
      .map<EgresoCajaEco>((f) => ({
        fecha: String(f.fecha || '').slice(0, 10),
        monto: Number(f.monto_total) || 0,
        concepto: (f.concepto || 'Egreso').trim() || 'Egreso'
      }))
  })
}

/** Pagos de liquidación / sueldos registrados en RRHH. */
export function liquidacionesEmpleadosDelPeriodo(desde: string, hasta: string) {
  return envolver(async () => {
    type Fila = {
      fecha: string
      monto: number
      id_usuario: number
      usuario: { nombre: string | null } | null
    }
    const filas = await paginar<Fila>((a, b) =>
      cliente()
        .from('rrhh_liquidacion_pagos')
        .select('fecha, monto, id_usuario, usuario:usuarios!id_usuario(nombre)')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('id', { ascending: true })
        .range(a, b)
    )
    return filas.map<LiquidacionEmpleadoEco>((f) => ({
      fecha: String(f.fecha || '').slice(0, 10),
      monto: Number(f.monto) || 0,
      empleado: (f.usuario?.nombre || '').trim() || `Empleado #${f.id_usuario}`
    }))
  })
}
