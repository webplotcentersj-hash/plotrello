import { supabase } from './supabaseClient'
import type { BaseComision, MomentoComision } from '../features/comisiones/calculoComisiones'

export type ComisionConfig = {
  id: number
  base: BaseComision
  momento: MomentoComision
  porcentaje_default: number
  alicuota_iva: number
  updated_at?: string
}

export type ComisionVendedor = {
  id_usuario: number
  nombre: string
  rol: string
  porcentaje: number
  activo: boolean
  ventas: number
}

export type ComisionVenta = {
  id: number
  id_venta: number
  numero_venta: string | null
  id_vendedor: number | null
  nombre_vendedor: string | null
  fecha_venta: string
  base: BaseComision
  monto_venta: number
  monto_cobrado: number
  base_monto: number
  porcentaje: number
  monto_devengado: number
  monto_liquidado: number
  estado: 'pendiente' | 'parcial' | 'liquidada' | 'anulada'
}

export type ComisionResumenVendedor = {
  id_vendedor: number | null
  nombre_vendedor: string
  ventas: number
  monto_venta: number
  base_monto: number
  devengado: number
  liquidado: number
  pendiente: number
}

export type ComisionLiquidacion = {
  id: number
  periodo: string
  id_vendedor: number
  nombre_vendedor: string | null
  total: number
  estado: 'borrador' | 'aprobada' | 'pagada' | 'anulada'
  fecha_aprobacion?: string | null
  fecha_pago?: string | null
  observaciones?: string | null
  items: Array<{ id: number; id_venta: number; numero_venta: string | null; base_monto: number; porcentaje: number; monto: number }>
}

export type Resultado<T> = { success: boolean; data?: T; error?: string }

/** Mismo criterio que las escrituras comerciales: actor real, sin fallback. */
function actorId(): number {
  const directo = Number(localStorage.getItem('usuario_id')) || 0
  if (directo > 0) return directo
  try {
    const raw = localStorage.getItem('usuario')
    if (raw) {
      const id = Number(JSON.parse(raw)?.id)
      if (id > 0) return id
    }
  } catch {
    /* ignore */
  }
  throw new Error('Sesión requerida para ver comisiones')
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<Resultado<T>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    const { data, error } = await supabase.rpc(fn, { p_actor_id: actorId(), ...args })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as T }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export function getConfigComisiones() {
  return rpc<{ config: ComisionConfig; vendedores: ComisionVendedor[] }>('comisiones_config_get')
}

export function guardarConfigComisiones(payload: Partial<ComisionConfig>) {
  return rpc<{ config: ComisionConfig; vendedores: ComisionVendedor[] }>('comisiones_guardar_config', { p_payload: payload })
}

export function guardarVendedorComision(idUsuario: number, porcentaje: number, activo: boolean) {
  return rpc<{ config: ComisionConfig; vendedores: ComisionVendedor[] }>('comisiones_guardar_vendedor', {
    p_id_usuario: idUsuario,
    p_porcentaje: porcentaje,
    p_activo: activo
  })
}

export function recalcularComisiones(desde: string, hasta: string) {
  return rpc<{ procesadas: number; devengado: number }>('comisiones_recalcular', { p_desde: desde, p_hasta: hasta })
}

export function listarComisiones(desde: string, hasta: string) {
  return rpc<{ por_vendedor: ComisionResumenVendedor[]; ventas: ComisionVenta[]; pendiente_total: number }>(
    'comisiones_listar',
    { p_desde: desde, p_hasta: hasta }
  )
}

export function listarLiquidaciones(limite = 24) {
  return rpc<ComisionLiquidacion[]>('comisiones_listar_liquidaciones', { p_limite: limite })
}

export function generarLiquidacion(periodo: string) {
  return rpc<{ periodo: string; liquidaciones: number }>('comisiones_generar_liquidacion', { p_periodo: periodo })
}

export function cambiarEstadoLiquidacion(
  id: number,
  estado: ComisionLiquidacion['estado'],
  opts: { fechaPago?: string | null; observaciones?: string | null } = {}
) {
  return rpc<ComisionLiquidacion>('comisiones_cambiar_estado_liquidacion', {
    p_id: id,
    p_estado: estado,
    p_fecha_pago: opts.fechaPago ?? null,
    p_observaciones: opts.observaciones ?? null
  })
}
