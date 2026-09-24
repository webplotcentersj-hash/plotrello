import { supabase } from '../services/supabaseClient'
import { getStaffAuthToken } from '../services/staffSession'
import { plotLabFetch } from './plotLabApiOrigin'
import { descargarArchivoUrl } from './cuentaCorrienteExport'

/**
 * Paso 26: documentos del alta de cuenta corriente (DNI, estatuto, constancia, domicilio, pagaré)
 * en el bucket privado `cc-documentos`. En la ficha se guarda una referencia `cc-doc:<path>` en vez
 * de una URL pública; para verlos se pide una URL firmada a /api/erp/cc-documento-url.
 * Las fichas viejas conservan su URL pública y siguen funcionando igual.
 */
const BUCKET = 'cc-documentos'
const PREFIX = 'cc-doc:'

export function esDocumentoPrivadoCc(ref: string | null | undefined): boolean {
  return !!ref && ref.startsWith(PREFIX)
}

export async function subirDocumentoCc(file: File, folder: string): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf'
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
  const path = `${cleanFolder}/${id}.${ext}`

  // Sin upsert: el bucket solo permite INSERT (no se puede leer ni pisar con la clave pública)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream'
  })
  if (error) throw new Error(`Error al subir archivo: ${error.message}`)
  return `${PREFIX}${path}`
}

async function urlFirmada(ref: string, download?: string): Promise<string> {
  const token = getStaffAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await plotLabFetch('/api/erp/cc-documento-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({ path: ref.slice(PREFIX.length), download })
  })
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: { url: string }
    error?: string
  } | null
  if (!res.ok || !json?.success || !json.data?.url) {
    throw new Error(json?.error || `No se pudo abrir el documento (HTTP ${res.status})`)
  }
  return json.data.url
}

/** Abre el documento en otra pestaña (la pestaña se abre antes del fetch para que no la bloquee el navegador). */
export async function abrirDocumentoCc(ref: string): Promise<void> {
  if (!esDocumentoPrivadoCc(ref)) {
    window.open(ref, '_blank', 'noopener,noreferrer')
    return
  }
  const win = window.open('', '_blank')
  try {
    const url = await urlFirmada(ref)
    if (win) win.location.href = url
    else window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    win?.close()
    window.alert(e instanceof Error ? e.message : 'No se pudo abrir el documento')
  }
}

export async function descargarDocumentoCc(ref: string, nombre?: string): Promise<void> {
  if (!esDocumentoPrivadoCc(ref)) {
    descargarArchivoUrl(ref, nombre)
    return
  }
  try {
    const ext = ref.split('.').pop() || 'pdf'
    const url = await urlFirmada(ref, nombre ? `${nombre}.${ext}` : undefined)
    descargarArchivoUrl(url, nombre)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'No se pudo descargar el documento')
  }
}
