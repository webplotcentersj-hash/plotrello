import { supabase } from './supabaseClient'
import apiService from './api'
import { nombreSeguroStorage, parseArchivosEnviados, type ArchivoEnviado } from '../utils/envioArchivosQr'

export type EstadoEnvioArchivosQr = 'nuevo' | 'recibido' | 'archivado'

export type EnvioArchivosQr = {
  id: number
  codigo: string
  archivos: ArchivoEnviado[]
  cantidad: number
  bytes: number
  estado: EstadoEnvioArchivosQr
  atendido_por: number | null
  atendido_por_nombre: string | null
  atendido_at: string | null
  created_at: string
}

export type SesionQrPantalla = {
  estado: 'abierta' | 'completada' | 'expirada' | 'error'
  archivos: ArchivoEnviado[]
  expiresAt: string | null
  error?: string
}

type Res<T> = { success: true; data: T } | { success: false; error: string }

function mensaje(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return fallback
}

function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ——— QR fijo (público, sin sesión) ———

/** Público: sube los archivos a Storage y registra el envío. Devuelve el código para el mostrador. */
export async function enviarArchivosQrFijo(
  files: File[],
  honeypot: string,
  onProgreso?: (hechos: number) => void
): Promise<Res<{ codigo: string }>> {
  if (!supabase) return { success: false, error: 'No hay conexión con Plot Center. Probá de nuevo.' }
  const carpeta = `envios-qr/${nuevoId()}`
  const subidos: ArchivoEnviado[] = []
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const path = `${carpeta}/${i + 1}_${nombreSeguroStorage(f.name)}`
      const { error } = await supabase.storage.from('archivos').upload(path, f, {
        cacheControl: '3600',
        upsert: false,
        contentType: f.type || undefined
      })
      if (error) return { success: false, error: `No se pudo subir "${f.name}". Revisá la conexión y probá de nuevo.` }
      const { data } = supabase.storage.from('archivos').getPublicUrl(path)
      subidos.push({ url: data.publicUrl, nombre: f.name.slice(0, 300), bytes: f.size })
      onProgreso?.(i + 1)
    }
    const { data, error } = await supabase.rpc('registrar_envio_archivos_qr', {
      p_archivos: subidos,
      p_honeypot: honeypot || null
    })
    if (error) return { success: false, error: 'No se pudo registrar el envío. Probá de nuevo en un momento.' }
    const out = (data ?? {}) as { ok?: boolean; codigo?: string; error?: string }
    if (!out.ok || !out.codigo) return { success: false, error: out.error || 'No se pudo registrar el envío.' }
    return { success: true, data: { codigo: out.codigo } }
  } catch (e) {
    return { success: false, error: mensaje(e, 'No se pudo enviar. Probá de nuevo.') }
  }
}

export async function listarEnviosArchivosQr(
  actorId: number,
  estado: EstadoEnvioArchivosQr | null
): Promise<Res<EnvioArchivosQr[]>> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { data, error } = await supabase.rpc('listar_envios_archivos_qr', {
    p_actor_id: actorId,
    p_estado: estado
  })
  if (error) {
    const falta = /listar_envios_archivos_qr|does not exist|schema cache/i.test(error.message)
    return {
      success: false,
      error: falta
        ? 'Falta aplicar el patch 2026-11-20_envios_archivos_qr.sql en Supabase.'
        : error.message
    }
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>
  return {
    success: true,
    data: rows.map((r) => ({
      id: Number(r.id),
      codigo: String(r.codigo ?? ''),
      archivos: parseArchivosEnviados(r.archivos),
      cantidad: Number(r.cantidad) || 0,
      bytes: Number(r.bytes) || 0,
      estado: (r.estado as EstadoEnvioArchivosQr) || 'nuevo',
      atendido_por: r.atendido_por == null ? null : Number(r.atendido_por),
      atendido_por_nombre: (r.atendido_por_nombre as string | null) ?? null,
      atendido_at: (r.atendido_at as string | null) ?? null,
      created_at: String(r.created_at ?? '')
    }))
  }
}

export async function marcarEnvioArchivosQr(
  id: number,
  actorId: number,
  estado: EstadoEnvioArchivosQr
): Promise<Res<true>> {
  if (!supabase) return { success: false, error: 'Sin conexión a Supabase' }
  const { error } = await supabase.rpc('marcar_envio_archivos_qr', {
    p_id: id,
    p_actor_id: actorId,
    p_estado: estado
  })
  if (error) return { success: false, error: error.message }
  return { success: true, data: true }
}

// ——— QR en pantalla (sesión temporal; reutiliza las sesiones del tótem) ———

export async function crearSesionQrPantalla(): Promise<Res<{ sessionId: string; expiresAt: string }>> {
  const r = await apiService.crearSesionQrUploadTotem()
  if (!r.success || !r.data) return { success: false, error: r.error || 'No se pudo crear el QR' }
  return { success: true, data: { sessionId: r.data.session_id, expiresAt: r.data.expires_at } }
}

export async function leerSesionQrPantalla(sessionId: string): Promise<SesionQrPantalla> {
  const r = await apiService.obtenerSesionQrUploadTotem(sessionId)
  if (!r.success || !r.data) return { estado: 'error', archivos: [], expiresAt: null, error: r.error }
  const d = r.data
  if (d.ok === false) {
    const vencida = /vencida/i.test(d.error || '')
    return { estado: vencida ? 'expirada' : 'error', archivos: [], expiresAt: null, error: d.error }
  }
  const estado = d.estado === 'completada' ? 'completada' : d.estado === 'expirada' ? 'expirada' : 'abierta'
  let archivos = parseArchivosEnviados(d.archivos)
  // Sesiones con un único archivo guardado como URL suelta.
  if (!archivos.length && d.archivo_url && /^https?:/i.test(d.archivo_url)) {
    archivos = [{ url: d.archivo_url, nombre: d.archivo_nombre || 'archivo', bytes: d.archivo_bytes ?? null }]
  }
  return { estado, archivos, expiresAt: d.expires_at ?? null }
}

/** Público: sube los archivos a una sesión de QR en pantalla y la cierra. */
export async function enviarArchivosSesionQr(
  sessionId: string,
  files: File[],
  onProgreso?: (hechos: number) => void
): Promise<Res<true>> {
  for (let i = 0; i < files.length; i++) {
    const r = await apiService.subirArchivoSesionTotemQr(files[i], sessionId, { finalizar: false })
    if (!r.success) return { success: false, error: r.error || `No se pudo subir "${files[i].name}".` }
    onProgreso?.(i + 1)
  }
  const fin = await apiService.finalizarSesionQrUploadTotem(sessionId)
  if (!fin.success) return { success: false, error: fin.error || 'Los archivos subieron pero no se pudo cerrar el envío.' }
  return { success: true, data: true }
}
