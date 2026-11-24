import { supabase } from './supabaseClient'

export type Resultado<T> = { success: boolean; data?: T; error?: string }

export type SaldoFavor = {
  id: number
  id_cliente: number | null
  cliente_nombre: string | null
  id_nota_credito: number
  id_factura_origen: number | null
  monto: number
  disponible: number
  created_at: string
}

export type TipoMovimientoSaldoFavor = 'devolucion' | 'aplicacion' | 'cuenta_corriente'

export type MovimientoSaldoFavor = {
  id: number
  id_saldo: number
  tipo: TipoMovimientoSaldoFavor
  monto: number
  fecha: string
  metodo_pago: string | null
  id_cuenta_por_cobrar: number | null
  observaciones: string | null
  created_at: string
}

export type MetodoDevolucion = 'Efectivo' | 'Transferencia'

export const ETIQUETA_MOVIMIENTO_SALDO: Record<TipoMovimientoSaldoFavor, string> = {
  devolucion: 'Devuelto',
  aplicacion: 'Usado en otra factura',
  cuenta_corriente: 'Pasado a cuenta corriente'
}

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
  throw new Error('Sesión requerida para mover saldos a favor')
}

function normalizarSaldo(r: Record<string, unknown>): SaldoFavor {
  return {
    id: Number(r.id),
    id_cliente: r.id_cliente != null ? Number(r.id_cliente) : null,
    cliente_nombre: (r.cliente_nombre as string) ?? null,
    id_nota_credito: Number(r.id_nota_credito),
    id_factura_origen: r.id_factura_origen != null ? Number(r.id_factura_origen) : null,
    monto: Number(r.monto) || 0,
    disponible: Number(r.disponible) || 0,
    created_at: String(r.created_at || '')
  }
}

async function ejecutar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  if (!supabase) return { success: false, error: 'No hay conexión a Supabase' }
  try {
    return { success: true, data: await fn() }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

/** Saldo generado por una nota de crédito (null si la nota no dejó saldo a favor). */
export function getSaldoFavorDeNota(idNotaCredito: number) {
  return ejecutar(async () => {
    const { data, error } = await supabase!
      .from('saldos_favor_clientes')
      .select('*')
      .eq('id_nota_credito', idNotaCredito)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const { data: movs, error: errMovs } = await supabase!
      .from('saldos_favor_movimientos')
      .select('*')
      .eq('id_saldo', data.id)
      .order('created_at', { ascending: true })
    if (errMovs) throw new Error(errMovs.message)
    return {
      saldo: normalizarSaldo(data),
      movimientos: (movs || []).map((m) => ({ ...m, monto: Number(m.monto) || 0 })) as MovimientoSaldoFavor[]
    }
  })
}

/** Saldos con disponible > 0 del cliente, para usarlos al cobrar otra factura. */
export function getSaldosFavorDisponibles(idCliente: number) {
  return ejecutar(async () => {
    const { data, error } = await supabase!
      .from('saldos_favor_clientes')
      .select('*')
      .eq('id_cliente', idCliente)
      .gt('disponible', 0)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data || []).map(normalizarSaldo)
  })
}

async function rpc(nombre: string, args: Record<string, unknown>) {
  const { data, error } = await supabase!.rpc(nombre, { p_actor_id: actorId(), ...args })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

export function devolverSaldoFavor(
  idSaldo: number,
  monto: number,
  metodo: MetodoDevolucion,
  fecha: string,
  observaciones?: string
) {
  return ejecutar(() =>
    rpc('saldo_favor_devolver', {
      p_id_saldo: idSaldo,
      p_monto: monto,
      p_metodo_pago: metodo,
      p_fecha: fecha,
      p_observaciones: observaciones || null
    })
  )
}

export function aplicarSaldoFavor(idSaldo: number, idCuentaPorCobrar: number, monto: number) {
  return ejecutar(() =>
    rpc('saldo_favor_aplicar', { p_id_saldo: idSaldo, p_id_cuenta_por_cobrar: idCuentaPorCobrar, p_monto: monto })
  )
}

export function pasarSaldoFavorACuentaCorriente(idSaldo: number, monto: number) {
  return ejecutar(() => rpc('saldo_favor_a_cuenta_corriente', { p_id_saldo: idSaldo, p_monto: monto }))
}

/** Cuánto aplicar automáticamente: lo menor entre lo pendiente y lo disponible (a centavos). */
export function montoSugeridoAplicacion(pendiente: number, disponible: number): number {
  return Math.max(0, Math.round(Math.min(pendiente, disponible) * 100) / 100)
}
