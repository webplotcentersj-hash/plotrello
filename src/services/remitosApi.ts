import type { PendientesRpc, Remito } from '../features/remitos/remitosLogica'
import { supabase } from './supabaseClient'

export type Resultado<T> = { success: boolean; data?: T; error?: string }

/** Punto de venta del remito X interno (numeración propia, no depende de ARCA). */
export const PUNTO_VENTA_REMITO = 1

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
  throw new Error('Sesión requerida para emitir remitos')
}

function nombreUsuario(): string | null {
  try {
    const raw = localStorage.getItem('usuario')
    if (!raw) return null
    const u = JSON.parse(raw) as { nombre?: string; nombre_completo?: string; username?: string }
    return u.nombre_completo || u.nombre || u.username || null
  } catch {
    return null
  }
}

type FilaRemito = Omit<Remito, 'items'> & { items?: Remito['items'] | null }

function normalizar(fila: FilaRemito): Remito {
  const items = [...(fila.items ?? [])]
    .map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      cantidad_pedida: i.cantidad_pedida === null || i.cantidad_pedida === undefined ? null : Number(i.cantidad_pedida),
      cantidad_previa: i.cantidad_previa === null || i.cantidad_previa === undefined ? null : Number(i.cantidad_previa)
    }))
    .sort((a, b) => a.orden - b.orden)
  return { ...fila, items }
}

export type FiltrosRemitos = {
  estado?: 'Emitido' | 'Anulado' | ''
  desde?: string
  hasta?: string
  idVenta?: number
  idOp?: number
  limite?: number
}

export async function listarRemitos(filtros: FiltrosRemitos = {}): Promise<Resultado<Remito[]>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    let q = supabase
      .from('remitos')
      .select('*, items:remitos_items(*)')
      .order('fecha_emision', { ascending: false })
      .order('id', { ascending: false })
      .limit(filtros.limite ?? 300)
    if (filtros.estado) q = q.eq('estado', filtros.estado)
    if (filtros.desde) q = q.gte('fecha_emision', filtros.desde)
    if (filtros.hasta) q = q.lte('fecha_emision', filtros.hasta)
    if (filtros.idVenta) q = q.eq('id_venta', filtros.idVenta)
    if (filtros.idOp) q = q.eq('id_op', filtros.idOp)
    const { data, error } = await q
    if (error) return { success: false, error: error.message }
    return { success: true, data: ((data ?? []) as FilaRemito[]).map(normalizar) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al listar remitos' }
  }
}

/** Remitos de una venta y/o de su OP, el más viejo primero (orden de entrega). */
export async function remitosDeOrigen(idVenta: number | null, idOp: number | null): Promise<Resultado<Remito[]>> {
  if (!idVenta && !idOp) return { success: true, data: [] }
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    const filtro = [idVenta ? `id_venta.eq.${idVenta}` : null, idOp ? `id_op.eq.${idOp}` : null].filter(Boolean).join(',')
    const { data, error } = await supabase
      .from('remitos')
      .select('*, items:remitos_items(*)')
      .or(filtro)
      .order('id', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: ((data ?? []) as FilaRemito[]).map(normalizar) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al leer remitos' }
  }
}

export async function pendientesDeEntrega(idVenta: number, idOp: number | null): Promise<Resultado<PendientesRpc>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    const { data, error } = await supabase.rpc('remitos_pendientes', { p_id_venta: idVenta, p_id_op: idOp })
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as PendientesRpc }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al calcular pendientes' }
  }
}

export type VentaBuscada = {
  id: number
  numero_venta: string
  cliente_nombre: string
  cliente_dni_cuit: string | null
  cliente_direccion: string | null
  cliente_telefono: string | null
  id_op: number | null
  numero_op: string | null
  estado_pago: string
  fecha_venta: string
}

/** Ventas para elegir de cuál se emite el remito (por número de venta, cliente u OP). */
export async function buscarVentasParaRemito(texto: string): Promise<Resultado<VentaBuscada[]>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    // los caracteres de la sintaxis de filtros de PostgREST no deben colarse desde lo que escribe la persona
    const limpio = texto.trim().replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ')
    let q = supabase
      .from('ventas')
      .select('id, numero_venta, cliente_nombre, cliente_dni_cuit, cliente_direccion, cliente_telefono, id_op, numero_op, estado_pago, fecha_venta')
      .neq('estado_pago', 'Cancelado')
      .order('id', { ascending: false })
      .limit(15)
    if (limpio) {
      q = q.or(`numero_venta.ilike.%${limpio}%,cliente_nombre.ilike.%${limpio}%,numero_op.ilike.%${limpio}%`)
    }
    const { data, error } = await q
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as VentaBuscada[] }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al buscar ventas' }
  }
}

export type EntregaOp = {
  numero_op: string
  entregado: boolean
  fecha_entrega_efectiva: string | null
  entregado_a: string | null
  dni_retira: string | null
}

/** Entrega ya registrada en la OP (firma de retiro). No descuenta cantidades: solo se muestra. */
export async function entregaRegistradaOp(idOp: number): Promise<Resultado<EntregaOp | null>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('numero_op, entregado, fecha_entrega_efectiva, entregado_a, dni_retira')
      .eq('id', idOp)
      .maybeSingle()
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data as EntregaOp | null) ?? null }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al leer la entrega de la OP' }
  }
}

export type NuevoRemito = {
  id_venta?: number | null
  id_op?: number | null
  numero_op?: string | null
  cliente_nombre?: string
  cliente_documento?: string | null
  cliente_domicilio?: string | null
  cliente_telefono?: string | null
  fecha_emision?: string
  fecha_entrega?: string | null
  entregado_a?: string | null
  dni_retira?: string | null
  transportista?: string | null
  observaciones?: string | null
  items: Array<{
    id_venta_item?: number
    id_op_linea?: number
    codigo_articulo?: string | null
    descripcion: string
    unidad?: string | null
    cantidad: number
    observaciones?: string | null
  }>
}

export async function crearRemito(remito: NuevoRemito): Promise<Resultado<Remito>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    const { data, error } = await supabase.rpc('remito_crear', {
      p_actor_id: actorId(),
      p_payload: { punto_venta: PUNTO_VENTA_REMITO, usuario_nombre: nombreUsuario(), ...remito }
    })
    if (error) return { success: false, error: error.message }
    return { success: true, data: normalizar(data as FilaRemito) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al emitir el remito' }
  }
}

export async function anularRemito(idRemito: number, motivo: string): Promise<Resultado<Remito>> {
  if (!supabase) return { success: false, error: 'Supabase no configurado' }
  try {
    const { data, error } = await supabase.rpc('remito_anular', {
      p_actor_id: actorId(),
      p_id_remito: idRemito,
      p_motivo: motivo
    })
    if (error) return { success: false, error: error.message }
    // la base devuelve solo la cabecera: se vuelve a leer con sus líneas
    const leido = await listarRemitos({ limite: 1000 })
    const remito = leido.data?.find((r) => r.id === idRemito)
    return { success: true, data: remito ?? normalizar({ ...(data as FilaRemito), items: [] }) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al anular el remito' }
  }
}
