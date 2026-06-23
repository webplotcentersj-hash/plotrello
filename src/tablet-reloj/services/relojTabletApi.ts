import { plotLabFetch } from '../../utils/plotLabApiOrigin'
import { getMarcacionTimestamptzIso } from '../../utils/dateUtils'

const STORAGE_KEY = 'reloj_tablet_api_key'

export type EmpleadoRelojTablet = {
  id_usuario: number
  nombre: string
  apellido: string
  sector: string
  foto_url: string | null
  login: string
  nombre_completo: string
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

async function parseApiJson<T>(resp: Response): Promise<T> {
  const text = await resp.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.trim().slice(0, 120) || `HTTP ${resp.status}`
    throw new Error(snippet.startsWith('A server error') ? 'Error del servidor API. Reintentá en unos segundos.' : snippet)
  }
}

export async function fetchEmpleadosRelojTablet(): Promise<EmpleadoRelojTablet[]> {
  const resp = await plotLabFetch('/api/plotai/reloj-tablet-empleados', { headers: headers() })
  const json = await parseApiJson<{ success?: boolean; empleados?: EmpleadoRelojTablet[]; error?: string }>(resp)
  if (!resp.ok || !json.success) {
    throw new Error(json.error || 'No se pudo cargar empleados')
  }
  return json.empleados ?? []
}

export type IdentificacionTabletResult = {
  match: boolean
  id_usuario?: number
  confianza?: number
  nombre?: string
  mensaje: string
}

export async function identificarSelfieRelojTablet(selfieDataUrl: string): Promise<IdentificacionTabletResult> {
  const resp = await plotLabFetch('/api/plotai/reloj-tablet-identificar', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ selfie_data_url: selfieDataUrl })
  })
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
  const resp = await plotLabFetch('/api/plotai/reloj-tablet-verificar', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_usuario: idUsuario, selfie_data_url: selfieDataUrl })
  })
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
  const resp = await plotLabFetch('/api/plotai/reloj-tablet-marcar-auto', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selfie_data_url: selfieDataUrl,
      dispositivo_id: 'tablet-reloj-1',
      marcado_at: getMarcacionTimestamptzIso()
    })
  })
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

export async function marcarRelojTablet(opts: {
  idUsuario: number
  selfieDataUrl?: string
  confianza?: number
  detalle?: string
  dispositivoId?: string
  marcadoAt?: string
}): Promise<MarcacionTabletResult> {
  const resp = await plotLabFetch('/api/plotai/reloj-tablet-marcar', {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_usuario: opts.idUsuario,
      selfie_data_url: opts.selfieDataUrl,
      confianza: opts.confianza,
      detalle: opts.detalle,
      dispositivo_id: opts.dispositivoId || 'tablet-reloj-1',
      marcado_at: opts.marcadoAt ?? getMarcacionTimestamptzIso()
    })
  })
  const json = await parseApiJson<{ success?: boolean; data?: MarcacionTabletResult; error?: string }>(resp)
  if (!resp.ok || !json.success || !json.data) {
    throw new Error(json.error || 'No se pudo registrar la marcación')
  }
  return json.data
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
