import { TOTEM_PRINT_MAX_FILE_BYTES, TOTEM_PRINT_MAX_FILE_MB, TOTEM_PRINT_MAX_FILES } from '../constants/totemPrint'
import { getArgentinaDateString, isoToArgentinaDateKey } from './dateUtils'

/** QR fijo impreso: el cliente sube archivos sin sesión y recibe un código. */
export const ENVIAR_ARCHIVOS_PUBLICO = '/enviar-archivos'
/** QR en pantalla: sesión temporal creada por el personal (reutiliza las sesiones del tótem). */
export const enviarArchivosSesion = (sessionId: string) => `${ENVIAR_ARCHIVOS_PUBLICO}/${sessionId}`
/** Pantalla del personal: QR en pantalla + bandeja de envíos por QR fijo. */
export const MOSTRADOR_ARCHIVOS_QR = '/mostrador/archivos-qr'

/** Notificación de un envío por QR fijo. */
export function notificationIsEnvioArchivosQr(n: {
  origen?: string | null
  related_id?: string | null
  title?: string | null
}): boolean {
  if (n.origen === 'envio_archivos_qr') return true
  if (String(n.related_id || '').startsWith('envio-archivos-qr:')) return true
  const title = (n.title ?? '').toLowerCase()
  return title.includes('archivos recibidos por qr') || title.includes('archivos por qr')
}

export function parseEnvioArchivosQrId(relatedId?: string | null): number | null {
  const m = /^envio-archivos-qr:(\d+)$/i.exec(String(relatedId || '').trim())
  if (!m) return null
  const id = Number(m[1])
  return Number.isFinite(id) && id > 0 ? id : null
}

/** Ruta de la herramienta, opcionalmente enfocada en un envío. */
export function mostradorArchivosQrPath(opts?: {
  id?: number | null
  codigo?: string | null
}): string {
  const q = new URLSearchParams()
  if (opts?.id && opts.id > 0) q.set('id', String(opts.id))
  if (opts?.codigo) q.set('codigo', String(opts.codigo).replace(/\D/g, '').slice(0, 4))
  const s = q.toString()
  return s ? `${MOSTRADOR_ARCHIVOS_QR}?${s}` : MOSTRADOR_ARCHIVOS_QR
}

/**
 * Recibidos / archivados de la bandeja: solo el día calendario AR.
 * Al día siguiente dejan de aparecer en esas pestañas.
 * Si no hay atendido_at, usa created_at como respaldo.
 */
export function esEnvioAtendidoHoy(
  atendidoAt: string | null | undefined,
  hoyYmd?: string,
  fallbackIso?: string | null
): boolean {
  const iso = atendidoAt || fallbackIso
  if (!iso) return false
  const dia = isoToArgentinaDateKey(iso)
  if (!dia) return false
  return dia === (hoyYmd || getArgentinaDateString())
}

export const ENVIO_MAX_ARCHIVOS = TOTEM_PRINT_MAX_FILES
export const ENVIO_MAX_BYTES = TOTEM_PRINT_MAX_FILE_BYTES
export const ENVIO_MAX_MB = TOTEM_PRINT_MAX_FILE_MB

export const ENVIO_EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'] as const
export const ENVIO_ACCEPT = '.pdf,application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,.heic'

export type ArchivoEnviado = { url: string; nombre: string; bytes?: number | null }

export function extensionDe(nombre: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nombre.trim())
  return m ? m[1].toLowerCase() : ''
}

export function esPdf(nombre: string): boolean {
  return extensionDe(nombre) === 'pdf'
}

/** Imágenes que el navegador puede mostrar como miniatura (HEIC no). */
export function esImagenVisible(nombre: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extensionDe(nombre))
}

/**
 * Agrega archivos a la selección respetando cupo, tamaño y formato.
 * Devuelve la nueva lista y un aviso si algo quedó afuera.
 */
export function agregarArchivosElegidos<T extends { name: string; size: number }>(
  actuales: T[],
  nuevos: T[]
): { lista: T[]; aviso: string | null } {
  const avisos: string[] = []
  const lista = [...actuales]
  for (const f of nuevos) {
    if (lista.length >= ENVIO_MAX_ARCHIVOS) {
      avisos.push(`Máximo ${ENVIO_MAX_ARCHIVOS} archivos por envío.`)
      break
    }
    if (!(ENVIO_EXTENSIONES as readonly string[]).includes(extensionDe(f.name))) {
      avisos.push(`"${f.name}" no es PDF ni imagen.`)
      continue
    }
    if (f.size > ENVIO_MAX_BYTES) {
      avisos.push(`"${f.name}" supera ${ENVIO_MAX_MB} MB.`)
      continue
    }
    if (lista.some((x) => x.name === f.name && x.size === f.size)) continue
    lista.push(f)
  }
  return { lista, aviso: avisos.length ? avisos.join(' ') : null }
}

export function formatearBytes(bytes: number | null | undefined): string {
  const b = Number(bytes) || 0
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} KB`
  return `${b} B`
}

/** Nombre seguro para Storage, conservando la extensión. */
export function nombreSeguroStorage(nombre: string): string {
  const ext = extensionDe(nombre) || 'bin'
  const base = nombre
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `${base || 'archivo'}.${ext}`
}

/** Normaliza la lista de archivos que devuelve la BD (jsonb). */
export function parseArchivosEnviados(raw: unknown): ArchivoEnviado[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      url: String(f.url ?? ''),
      nombre: String(f.nombre ?? '') || 'archivo',
      bytes: f.bytes == null ? null : Number(f.bytes)
    }))
    .filter((f) => f.url.startsWith('http'))
}
