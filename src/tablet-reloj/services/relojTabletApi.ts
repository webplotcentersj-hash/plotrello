import { plotLabFetch } from '../../utils/plotLabApiOrigin'
import { getMarcacionTimestamptzIso } from '../../utils/dateUtils'
import {
  isLikelyNetworkError,
  isRelojMarcarPayload,
  registerSyncHandler,
  syncQueueEnqueue,
  type SyncJob
} from '../../utils/syncQueue'
import { getDispositivoId } from '../utils/tabletRelojKiosk'

const STORAGE_KEY = 'reloj_tablet_api_key'

export type EmpleadoRelojTablet = {
  id_usuario: number
  nombre: string
  apellido: string
  sector: string
  foto_url: string | null
  login: string
  nombre_completo: string
  entrada_hoy?: string | null
  salida_hoy?: string | null
  tiene_foto_legajo?: boolean
  /** Fotos extra de enrolamiento facial (además del legajo). */
  fotos_extra?: string[]
}

export type MarcacionTabletResult = {
  id_usuario: number
  nombre: string
  login: string
  tipo: 'entrada' | 'salida'
  fecha: string
  hora: string
  /** HH:mm calculado en BD con America/Argentina/Buenos_Aires */
  hora_argentina?: string
  tarde: boolean
  minutos_tarde: number
  horas_trabajadas: number | null
  mensaje: string
}

export type VerificacionTabletResult = {
  match: boolean
  confianza: number
  motivo?: string
  mensaje: string
  nombre?: string
  omitir_verificacion?: boolean
}

export type DetectorPresenciaResult = {
  ok: boolean
  skipped?: boolean
  rostros?: number
  personas?: number
  metodo?: string
  motivo?: string
  sugerencia?: string
  ms?: number
}

export function getRelojTabletApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setRelojTabletApiKey(key: string) {
  if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim())
  else localStorage.removeItem(STORAGE_KEY)
}

function headers(): HeadersInit {
  const key = getRelojTabletApiKey()
  return key ? { 'X-Reloj-Tablet-Key': key } : {}
}

async function plotLabFetchTimeout(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await plotLabFetch(path, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('La identificación tardó demasiado. Parate de frente e intentá de nuevo.')
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

async function parseApiJson<T>(resp: Response): Promise<T> {
  const text = await resp.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.trim().slice(0, 160) || `HTTP ${resp.status}`
    if (
      resp.status === 504 ||
      snippet.startsWith('A server error') ||
      snippet.includes('FUNCTION_INVOCATION_TIMEOUT')
    ) {
      throw new Error('La identificación tardó demasiado. Parate de frente e intentá de nuevo.')
    }
    throw new Error(snippet.startsWith('<') ? 'Error del servidor API. Reintentá en unos segundos.' : snippet)
  }
}

export async function fetchEmpleadosRelojTablet(): Promise<EmpleadoRelojTablet[]> {
  try {
    const resp = await plotLabFetch('/api/plotai/reloj-tablet-empleados', { headers: headers() })
    const json = await parseApiJson<{ success?: boolean; empleados?: EmpleadoRelojTablet[]; error?: string }>(resp)
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'No se pudo cargar empleados')
    }
    const list = json.empleados ?? []
    try {
      localStorage.setItem('reloj_tablet_empleados_cache_v1', JSON.stringify(list))
    } catch {
      /* quota */
    }
    return list
  } catch (e) {
    if (!isLikelyNetworkError(e)) throw e
    try {
      const raw = localStorage.getItem('reloj_tablet_empleados_cache_v1')
      if (raw) return JSON.parse(raw) as EmpleadoRelojTablet[]
    } catch {
      /* ignore */
    }
    throw e
  }
}

type FacialIndicePayload = {
  descriptores: import('./faceLocalMatch').FaceDescriptorRecord[]
  meta: {
    indexed_count?: number
    failed_count?: number
    total_fotos?: number
    built_at?: string | null
    signature?: string
  } | null
}

let facialIndiceCache: { at: number; data: FacialIndicePayload } | null = null
let facialIndiceInflight: Promise<FacialIndicePayload> | null = null
const FACIAL_INDICE_TTL_MS = 5 * 60 * 1000

export async function fetchFacialIndiceRelojTablet(force = false): Promise<FacialIndicePayload> {
  if (!force && facialIndiceCache && Date.now() - facialIndiceCache.at < FACIAL_INDICE_TTL_MS) {
    return facialIndiceCache.data
  }
  if (!force && facialIndiceInflight) return facialIndiceInflight

  facialIndiceInflight = (async () => {
    const resp = await plotLabFetch('/api/plotai/reloj-tablet-facial-indice', { headers: headers() })
    const json = await parseApiJson<{
      success?: boolean
      error?: string
      meta?: FacialIndicePayload['meta']
      descriptores?: FacialIndicePayload['descriptores']
    }>(resp)
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'No se pudo cargar el índice facial')
    }
    const data: FacialIndicePayload = {
      descriptores: json.descriptores ?? [],
      meta: json.meta ?? null
    }
    facialIndiceCache = { at: Date.now(), data }
    return data
  })().finally(() => {
    facialIndiceInflight = null
  })

  return facialIndiceInflight
}

export type IdentificacionTabletResult = {
  match: boolean
  id_usuario?: number
  confianza?: number
  nombre?: string
  mensaje: string
}

export async function precalentarLegajosRelojTablet(): Promise<void> {
  try {
    await plotLabFetch('/api/plotai/reloj-tablet-precalentar', {
      method: 'POST',
      headers: headers()
    })
  } catch {
    /* no bloquear la UI */
  }
}

export async function detectarPresenciaRelojTablet(selfieDataUrl: string): Promise<DetectorPresenciaResult> {
  try {
    const resp = await plotLabFetchTimeout(
      '/api/plotai/reloj-tablet-detectar',
      {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ selfie_data_url: selfieDataUrl })
      },
      25_000
    )
    const json = await parseApiJson<
      DetectorPresenciaResult & { success?: boolean; error?: string; skipped?: boolean; sugerencia?: string }
    >(resp)
    if (!resp.ok || json.success === false) {
      console.warn('Detector no disponible, se omite filtro YOLO:', json.error)
      return { ok: true, skipped: true, motivo: json.error || 'Detector no disponible' }
    }
    if (json.skipped) {
      return { ok: true, skipped: true, motivo: json.motivo }
    }
    return {
      ok: Boolean(json.ok),
      rostros: json.rostros,
      personas: json.personas,
      metodo: json.metodo,
      motivo: json.motivo,
      sugerencia: json.sugerencia,
      ms: json.ms
    }
  } catch (e) {
    console.warn('Detector falló, se omite filtro YOLO:', e)
    return {
      ok: true,
      skipped: true,
      motivo: e instanceof Error ? e.message : 'Detector no disponible'
    }
  }
}

export async function identificarSelfieRelojTablet(selfieDataUrl: string): Promise<IdentificacionTabletResult> {
  const resp = await plotLabFetchTimeout(
    '/api/plotai/reloj-tablet-identificar',
    {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ selfie_data_url: selfieDataUrl })
    },
    50_000
  )
  const json = await parseApiJson<IdentificacionTabletResult & { success?: boolean; error?: string }>(resp)
  if (!resp.ok || json.success === false) {
    throw new Error(json.error || 'Identificación fallida')
  }
  return json
}

export async function verificarSelfieRelojTablet(
  idUsuario: number,
  selfieDataUrl: string
): Promise<VerificacionTabletResult> {
  const resp = await plotLabFetchTimeout(
    '/api/plotai/reloj-tablet-verificar',
    {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario: idUsuario, selfie_data_url: selfieDataUrl })
    },
    35_000
  )
  const json = await parseApiJson<VerificacionTabletResult & { success?: boolean; error?: string }>(resp)
  if (!resp.ok || json.success === false) {
    throw new Error(json.error || 'Verificación fallida')
  }
  return json
}

export async function marcarAutoRelojTablet(selfieDataUrl: string): Promise<{
  match: boolean
  data?: MarcacionTabletResult
  nombre?: string
  confianza?: number
  mensaje?: string
}> {
  const resp = await plotLabFetchTimeout(
    '/api/plotai/reloj-tablet-marcar-auto',
    {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selfie_data_url: selfieDataUrl,
        dispositivo_id: getDispositivoId(),
        marcado_at: getMarcacionTimestamptzIso()
      })
    },
    35_000
  )
  const json = await parseApiJson<{
    success?: boolean
    match?: boolean
    data?: MarcacionTabletResult
    nombre?: string
    confianza?: number
    mensaje?: string
    error?: string
  }>(resp)
  if (!resp.ok || json.success === false) {
    throw new Error(json.error || json.mensaje || 'No se pudo marcar')
  }
  return {
    match: json.match ?? false,
    data: json.data,
    nombre: json.nombre,
    confianza: json.confianza,
    mensaje: json.mensaje
  }
}

async function marcarRelojTabletOnline(opts: {
  idUsuario: number
  selfieDataUrl?: string
  confianza?: number
  detalle?: string
  dispositivoId?: string
  marcadoAt?: string
  omitirFoto?: boolean
}): Promise<MarcacionTabletResult> {
  const resp = await plotLabFetchTimeout(
    '/api/plotai/reloj-tablet-marcar',
    {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_usuario: opts.idUsuario,
        selfie_data_url: opts.selfieDataUrl,
        confianza: opts.confianza,
        detalle: opts.detalle,
        dispositivo_id: opts.dispositivoId || getDispositivoId(),
        marcado_at: opts.marcadoAt ?? getMarcacionTimestamptzIso(),
        omitir_foto: opts.omitirFoto === true
      })
    },
    35_000
  )
  const json = await parseApiJson<{ success?: boolean; data?: MarcacionTabletResult; error?: string }>(resp)
  if (!resp.ok || !json.success || !json.data) {
    throw new Error(json.error || 'No se pudo registrar la marcación')
  }
  return json.data
}

function tipoHintOffline(idUsuario: number): 'entrada' | 'salida' {
  try {
    const raw = localStorage.getItem('reloj_tablet_empleados_cache_v1')
    if (!raw) return 'entrada'
    const list = JSON.parse(raw) as EmpleadoRelojTablet[]
    const emp = list.find((e) => e.id_usuario === idUsuario)
    if (emp?.entrada_hoy && !emp.salida_hoy) return 'salida'
  } catch {
    /* ignore */
  }
  return 'entrada'
}

function nombreHintOffline(idUsuario: number): string {
  try {
    const raw = localStorage.getItem('reloj_tablet_empleados_cache_v1')
    if (!raw) return `Usuario ${idUsuario}`
    const list = JSON.parse(raw) as EmpleadoRelojTablet[]
    const emp = list.find((e) => e.id_usuario === idUsuario)
    if (emp?.nombre_completo) return emp.nombre_completo
    if (emp) return `${emp.apellido || ''} ${emp.nombre || ''}`.trim() || emp.login
  } catch {
    /* ignore */
  }
  return `Usuario ${idUsuario}`
}

/** Marca en servidor; si no hay red, encola y confirma en local (sync al volver). */
export async function marcarRelojTablet(opts: {
  idUsuario: number
  selfieDataUrl?: string
  confianza?: number
  detalle?: string
  dispositivoId?: string
  marcadoAt?: string
  omitirFoto?: boolean
}): Promise<MarcacionTabletResult> {
  const marcadoAt = opts.marcadoAt ?? getMarcacionTimestamptzIso()
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  if (!offline) {
    try {
      return await marcarRelojTabletOnline(opts)
    } catch (e) {
      if (!isLikelyNetworkError(e)) throw e
    }
  }

  const tipo = tipoHintOffline(opts.idUsuario)
  const nombre = nombreHintOffline(opts.idUsuario)
  await syncQueueEnqueue('reloj_marcar', {
    idUsuario: opts.idUsuario,
    marcadoAt,
    dispositivoId: opts.dispositivoId || getDispositivoId(),
    detalle: opts.detalle || 'offline_queue',
    omitirFoto: true,
    tipoHint: tipo,
    nombreHint: nombre
  })

  // Actualizar caché local de entrada/salida del día para la siguiente marca.
  try {
    const raw = localStorage.getItem('reloj_tablet_empleados_cache_v1')
    if (raw) {
      const list = JSON.parse(raw) as EmpleadoRelojTablet[]
      const hora = new Date(marcadoAt).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      })
      const next = list.map((e) => {
        if (e.id_usuario !== opts.idUsuario) return e
        if (tipo === 'entrada') return { ...e, entrada_hoy: hora }
        return { ...e, salida_hoy: hora }
      })
      localStorage.setItem('reloj_tablet_empleados_cache_v1', JSON.stringify(next))
    }
  } catch {
    /* ignore */
  }

  return {
    id_usuario: opts.idUsuario,
    nombre,
    login: '',
    tipo,
    fecha: marcadoAt.slice(0, 10),
    hora: marcadoAt,
    hora_argentina: undefined,
    tarde: false,
    minutos_tarde: 0,
    horas_trabajadas: null,
    mensaje:
      tipo === 'entrada'
        ? 'Entrada guardada sin conexión · se sincroniza al volver la red'
        : 'Salida guardada sin conexión · se sincroniza al volver la red'
  }
}

let relojSyncHandlerReady = false

export function ensureRelojSyncHandlerRegistered(): void {
  if (relojSyncHandlerReady) return
  relojSyncHandlerReady = true
  registerSyncHandler('reloj_marcar', async (job: SyncJob) => {
    if (!isRelojMarcarPayload(job.payload)) throw new Error('Payload reloj inválido')
    const p = job.payload
    await marcarRelojTabletOnline({
      idUsuario: p.idUsuario,
      marcadoAt: p.marcadoAt,
      dispositivoId: p.dispositivoId,
      detalle: p.detalle || 'sync_queue',
      omitirFoto: true
    })
  })
}

export function fotoEmpleadoUrl(emp: EmpleadoRelojTablet): string | null {
  if (emp.foto_url) return emp.foto_url
  return null
}

export function inicialesEmpleado(emp: EmpleadoRelojTablet): string {
  const a = (emp.apellido || emp.nombre || emp.login || '?').trim()
  const b = (emp.nombre || '').trim()
  return `${a.charAt(0)}${b.charAt(0) || ''}`.toUpperCase()
}
