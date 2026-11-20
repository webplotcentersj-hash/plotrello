import { supabase } from './supabaseClient'
import type { SolicitudAltaClienteForm } from '../utils/solicitudAltaCliente'

export type EstadoSolicitudAltaCliente = 'pendiente' | 'aceptada' | 'rechazada'

export type SolicitudAltaCliente = {
  id: number
  nombre: string
  apellido: string
  dni_cuit: string
  telefono: string
  direccion: string
  email: string
  condicion_iva: string
  razon_social: string | null
  observaciones: string | null
  estado: EstadoSolicitudAltaCliente
  motivo_rechazo: string | null
  id_cliente: number | null
  cliente_existente: boolean
  revisado_por: number | null
  revisado_por_nombre: string | null
  revisado_at: string | null
  created_at: string
  /** Cliente que ya existe con el mismo DNI/CUIT o email (solo en pendientes). */
  posible_duplicado_id: number | null
  posible_duplicado_nombre: string | null
}

type Res<T> = { success: true; data: T } | { success: false; error: string }

function mensaje(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return fallback
}

/** Público (sin login): envía la solicitud. `honeypot` es el campo oculto anti-bots. */
export async function enviarSolicitudAltaCliente(
  f: SolicitudAltaClienteForm,
  honeypot: string
): Promise<Res<number>> {
  if (!supabase) return { success: false, error: 'Sin conexión. Probá de nuevo en unos minutos.' }
  const { data, error } = await supabase.rpc('crear_solicitud_alta_cliente', {
    p_nombre: f.nombre.trim(),
    p_apellido: f.apellido.trim(),
    p_dni_cuit: f.dniCuit.trim(),
    p_telefono: f.telefono.trim(),
    p_direccion: f.direccion.trim(),
    p_email: f.email.trim(),
    p_condicion_iva: f.condicionIva,
    p_razon_social: f.razonSocial.trim() || null,
    p_observaciones: f.observaciones.trim() || null,
    p_honeypot: honeypot || null
  })
  if (error) return { success: false, error: mensaje(error, 'No se pudo enviar la solicitud') }
  return { success: true, data: Number(data) || 0 }
}

export async function listarSolicitudesAltaCliente(
  actorId: number,
  estado: EstadoSolicitudAltaCliente | null = null
): Promise<Res<SolicitudAltaCliente[]>> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  const { data, error } = await supabase.rpc('listar_solicitudes_alta_cliente', {
    p_actor_id: actorId,
    p_estado: estado
  })
  if (error) return { success: false, error: mensaje(error, 'No se pudieron leer las solicitudes') }
  return {
    success: true,
    data: ((data as Array<Record<string, unknown>>) || []).map((r) => ({
      ...(r as unknown as SolicitudAltaCliente),
      id: Number(r.id),
      id_cliente: r.id_cliente == null ? null : Number(r.id_cliente),
      posible_duplicado_id: r.posible_duplicado_id == null ? null : Number(r.posible_duplicado_id),
      cliente_existente: r.cliente_existente === true
    }))
  }
}

export type CorreccionesAlta = Partial<{
  nombre: string
  apellido: string
  dni_cuit: string
  telefono: string
  direccion: string
  email: string
  condicion_iva: string
  razon_social: string
}>

/** Acepta: crea el cliente (o vincula uno existente) y devuelve su id. */
export async function aceptarSolicitudAltaCliente(params: {
  id: number
  actorId: number
  vincularClienteId?: number | null
  correcciones?: CorreccionesAlta
}): Promise<Res<number>> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  const c = params.correcciones || {}
  const { data, error } = await supabase.rpc('aceptar_solicitud_alta_cliente', {
    p_id: params.id,
    p_actor_id: params.actorId,
    p_vincular_cliente_id: params.vincularClienteId ?? null,
    p_nombre: c.nombre ?? null,
    p_apellido: c.apellido ?? null,
    p_dni_cuit: c.dni_cuit ?? null,
    p_telefono: c.telefono ?? null,
    p_direccion: c.direccion ?? null,
    p_email: c.email ?? null,
    p_condicion_iva: c.condicion_iva ?? null,
    p_razon_social: c.razon_social ?? null
  })
  if (error) return { success: false, error: mensaje(error, 'No se pudo dar de alta el cliente') }
  return { success: true, data: Number(data) }
}

export async function rechazarSolicitudAltaCliente(
  id: number,
  actorId: number,
  motivo: string
): Promise<Res<null>> {
  if (!supabase) return { success: false, error: 'Supabase no inicializado' }
  const { error } = await supabase.rpc('rechazar_solicitud_alta_cliente', {
    p_id: id,
    p_actor_id: actorId,
    p_motivo: motivo || null
  })
  if (error) return { success: false, error: mensaje(error, 'No se pudo rechazar') }
  return { success: true, data: null }
}
