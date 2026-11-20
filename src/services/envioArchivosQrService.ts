import { supabase } from './supabaseClient'
import apiService from './api'
import { extensionDe, nombreSeguroStorage, parseArchivosEnviados, type ArchivoEnviado } from '../utils/envioArchivosQr'

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

// ——— Subida con progreso real y en paralelo ———

const BUCKET = 'archivos'
/** Archivos subiendo a la vez: más rápido en 4G sin saturar la conexión. */
const SUBIDAS_EN_PARALELO = 3

/** Avance de cada archivo, de 0 a 1 (1 = subido y registrado). */
export type ProgresoEnvio = number[]

function contentTypeDe(f: File): string {
  if (f.type) return f.type
  const ext = extensionDe(f.name)
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return ext ? `image/${ext}` : 'application/octet-stream'
}

/**
 * Sube un archivo a Storage con XMLHttpRequest para poder informar el avance por bytes
 * (supabase-js no expone progreso). Usa la misma clave anon que el cliente.
 */
function subirConProgreso(path: string, file: File, onAvance: (fraccion: number) => void): Promise<string> {
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')
  const ruta = path.split('/').map(encodeURIComponent).join('/')
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${baseUrl}/storage/v1/object/${BUCKET}/${ruta}`)
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('Content-Type', contentTypeDe(file))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onAvance(Math.min(0.97, e.loaded / e.total))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${baseUrl}/storage/v1/object/public/${BUCKET}/${ruta}`)
      } else {
        reject(new Error(`HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('red'))
    xhr.ontimeout = () => reject(new Error('timeout'))
    xhr.timeout = 10 * 60 * 1000
    xhr.send(file)
  })
}

/** Corre `tareas` con un máximo de `limite` a la vez; corta en el primer error. */
async function enParalelo<T>(cantidad: number, limite: number, tarea: (i: number) => Promise<T>): Promise<T[]> {
  const out = new Array<T>(cantidad)
  let siguiente = 0
  let fallo: unknown = null
  const trabajador = async () => {
    while (fallo == null && siguiente < cantidad) {
      const i = siguiente++
      try {
        out[i] = await tarea(i)
      } catch (e) {
        fallo = e
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, cantidad) }, trabajador))
  if (fallo != null) throw fallo
  return out
}

function crearProgreso(n: number, onProgreso?: (p: ProgresoEnvio) => void) {
  const avance = new Array<number>(n).fill(0)
  return (i: number, v: number) => {
    avance[i] = v
    onProgreso?.([...avance])
  }
}

class ErrorSubida extends Error {
  archivo: string
  constructor(archivo: string) {
    super(archivo)
    this.archivo = archivo
  }
}

// ——— QR fijo (público, sin sesión) ———

/** Público: sube los archivos a Storage y registra el envío. Devuelve el código para el mostrador. */
export async function enviarArchivosQrFijo(
  files: File[],
  honeypot: string,
  onProgreso?: (p: ProgresoEnvio) => void
): Promise<Res<{ codigo: string }>> {
  if (!supabase) return { success: false, error: 'No hay conexión con Plot Center. Probá de nuevo.' }
  const carpeta = `envios-qr/${nuevoId()}`
  const avanzar = crearProgreso(files.length, onProgreso)
  try {
    const subidos = await enParalelo(files.length, SUBIDAS_EN_PARALELO, async (i) => {
      const f = files[i]
      const path = `${carpeta}/${i + 1}_${nombreSeguroStorage(f.name)}`
      try {
        const url = await subirConProgreso(path, f, (v) => avanzar(i, v))
        avanzar(i, 1)
        return { url, nombre: f.name.slice(0, 300), bytes: f.size } as ArchivoEnviado
      } catch {
        throw new ErrorSubida(f.name)
      }
    })
    const { data, error } = await supabase.rpc('registrar_envio_archivos_qr', {
      p_archivos: subidos,
      p_honeypot: honeypot || null
    })
    if (error) return { success: false, error: 'No se pudo registrar el envío. Probá de nuevo en un momento.' }
    const out = (data ?? {}) as { ok?: boolean; codigo?: string; error?: string }
    if (!out.ok || !out.codigo) return { success: false, error: out.error || 'No se pudo registrar el envío.' }
    return { success: true, data: { codigo: out.codigo } }
  } catch (e) {
    if (e instanceof ErrorSubida) {
      return { success: false, error: `No se pudo subir "${e.archivo}". Revisá la conexión y probá de nuevo.` }
    }
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

/**
 * Público: sube los archivos a una sesión de QR en pantalla (en paralelo, con progreso),
 * registra cada uno en cuanto termina —así la PC los va viendo llegar— y cierra la sesión.
 */
export async function enviarArchivosSesionQr(
  sessionId: string,
  files: File[],
  onProgreso?: (p: ProgresoEnvio) => void
): Promise<Res<true>> {
  if (!supabase) return { success: false, error: 'No hay conexión con Plot Center. Probá de nuevo.' }
  const avanzar = crearProgreso(files.length, onProgreso)
  const stamp = Date.now()
  try {
    await enParalelo(files.length, SUBIDAS_EN_PARALELO, async (i) => {
      const f = files[i]
      const path = `totem-qr-uploads/${sessionId}/${stamp}_${i + 1}_${nombreSeguroStorage(f.name)}`
      let url: string
      try {
        url = await subirConProgreso(path, f, (v) => avanzar(i, v))
      } catch {
        throw new ErrorSubida(f.name)
      }
      const { data, error } = await supabase!.rpc('registrar_archivo_sesion_qr_totem', {
        p_session_id: sessionId,
        p_archivo_url: url,
        p_archivo_nombre: f.name.slice(0, 500),
        p_archivo_bytes: f.size,
        p_finalizar: false
      })
      const out = (data ?? null) as { ok?: boolean; error?: string } | null
      if (error || (out && out.ok === false)) throw new Error(out?.error || error?.message || 'No se pudo registrar')
      avanzar(i, 1)
    })
  } catch (e) {
    if (e instanceof ErrorSubida) {
      return { success: false, error: `No se pudo subir "${e.archivo}". Revisá la conexión y probá de nuevo.` }
    }
    return { success: false, error: mensaje(e, 'No se pudo enviar. Probá de nuevo.') }
  }
  const fin = await apiService.finalizarSesionQrUploadTotem(sessionId)
  if (!fin.success) return { success: false, error: fin.error || 'Los archivos subieron pero no se pudo cerrar el envío.' }
  return { success: true, data: true }
}
