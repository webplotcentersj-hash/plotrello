import { GoogleGenAI } from '@google/genai'

export type SelfieParsed = { mimeType: string; base64: string }

export type CandidatoReloj = {
  id_usuario: number
  nombre: string
  foto: { mimeType: string; base64: string }
}

export type EmpleadoConFotoUrl = {
  id_usuario: number
  nombre: string
  foto_url: string
}

const LEGAJO_CACHE = new Map<string, { mimeType: string; base64: string; at: number }>()
const CACHE_TTL_MS = 20 * 60 * 1000

/** Umbral mínimo para aceptar un match 1:1 */
export const MATCH_MIN_IDENTIFY = 68
/** Umbral mínimo para verificación 1:1 (manual) */
export const MATCH_MIN_VERIFY = 70
/** Auto: confianza mínima para marcar sin segunda pasada */
export const MATCH_MIN_AUTO = 70
const EARLY_EXIT_CONF = 84
/** Comparaciones 1:1 en paralelo por oleada */
const CONCURRENCY = 6
/** Modelo rápido (evita 2.5 que tarda mucho con varias imágenes) */
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_TIMEOUT_MS = 10_000

export function stripDataUrl(dataUrl: string): SelfieParsed | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

export function tryParseJson(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(stripped) as Record<string, unknown>
  } catch {
    const a = stripped.indexOf('{')
    const b = stripped.lastIndexOf('}')
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(stripped.slice(a, b + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

/** Miniatura vía transform de Storage (mucho más liviana para Gemini). */
export function legajoThumbUrl(url: string): string {
  const u = String(url || '').trim()
  if (!u) return u
  if (u.includes('/storage/v1/object/public/')) {
    const rendered = u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = rendered.includes('?') ? '&' : '?'
    return `${rendered}${sep}width=320&height=320&resize=contain&quality=70`
  }
  return u
}

async function fetchImageRaw(url: string): Promise<SelfieParsed | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length > 2_500_000) return null
    const mimeType = resp.headers.get('content-type') || 'image/jpeg'
    return { mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg', base64: buf.toString('base64') }
  } catch {
    return null
  }
}

export async function fetchImageAsBase64Cached(url: string): Promise<SelfieParsed | null> {
  const key = String(url || '').trim()
  if (!key) return null
  const hit = LEGAJO_CACHE.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { mimeType: hit.mimeType, base64: hit.base64 }
  }
  const thumb = legajoThumbUrl(key)
  let parsed = await fetchImageRaw(thumb)
  if (!parsed && thumb !== key) {
    parsed = await fetchImageRaw(key)
  }
  if (!parsed) return null
  LEGAJO_CACHE.set(key, { ...parsed, at: Date.now() })
  return parsed
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} tardó demasiado`)), ms)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Comparación 1:1 — más fiable que “elegí entre 8 fotos”. */
async function compararUnEmpleado(
  apiKey: string,
  selfie: SelfieParsed,
  candidato: CandidatoReloj
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Reloj laboral. ¿La selfie EN VIVO y la foto de LEGAJO de "${candidato.nombre}" son LA MISMA PERSONA?
Ignorá fondo, ropa, peinado, barba, gafas o luz distinta. Enfocá solo el rostro.
Respondé SOLO JSON: {"match":true|false,"confianza":0-100}
match=true solo si es claramente la misma persona.`
            },
            { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
            { inlineData: { mimeType: candidato.foto.mimeType, data: candidato.foto.base64 } }
          ]
        }
      ]
    }),
    GEMINI_TIMEOUT_MS,
    'Gemini'
  )
  const parsed = tryParseJson(response.text ?? '')
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const match = parsed?.match === true && confianza >= MATCH_MIN_IDENTIFY
  if (!match) return null
  return { id_usuario: candidato.id_usuario, confianza, nombre: candidato.nombre }
}

async function cargarCandidatosLote(empleados: EmpleadoConFotoUrl[]): Promise<CandidatoReloj[]> {
  const loaded = await Promise.all(
    empleados.map(async (emp) => ({
      emp,
      foto: await fetchImageAsBase64Cached(emp.foto_url)
    }))
  )
  return loaded
    .filter((x): x is { emp: EmpleadoConFotoUrl; foto: NonNullable<typeof x.foto> } => !!x.foto)
    .map(({ emp, foto }) => ({
      id_usuario: emp.id_usuario,
      nombre: emp.nombre,
      foto
    }))
}

/**
 * Identifica al empleado con comparaciones 1:1 en paralelo (oleadas).
 * Más rápido y fehaciente que lotes multi-cara + segunda verificación.
 */
export async function identificarEmpleadoRapido(
  apiKey: string,
  selfie: SelfieParsed,
  empleados: EmpleadoConFotoUrl[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!empleados.length) return null

  const candidatos = await cargarCandidatosLote(empleados)
  if (!candidatos.length) return null

  let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null

  for (let i = 0; i < candidatos.length; i += CONCURRENCY) {
    const slice = candidatos.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      slice.map(async (c) => {
        try {
          return await compararUnEmpleado(apiKey, selfie, c)
        } catch (e) {
          console.warn('comparar facial falló', c.id_usuario, e instanceof Error ? e.message : e)
          return null
        }
      })
    )
    for (const hit of results) {
      if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
    }
    if (mejor && mejor.confianza >= EARLY_EXIT_CONF) return mejor
  }

  if (!mejor || mejor.confianza < MATCH_MIN_IDENTIFY) return null
  return mejor
}

export async function verificarParFacial(
  apiKey: string,
  selfie: SelfieParsed,
  referencia: SelfieParsed,
  nombreCompleto: string
): Promise<{ match: boolean; confianza: number; motivo: string }> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Sos un sistema de control de asistencia laboral en Argentina.
Compará si la persona de la FOTO EN VIVO (selfie) es la misma persona que la FOTO DE REFERENCIA del legajo de "${nombreCompleto}".
Ignorá fondo, ropa, peinado o luz. Enfocá el rostro.
Respondé SOLO JSON válido:
{"match":true|false,"confianza":0-100,"motivo":"breve en español"}

Reglas:
- match=true solo si confianza >= ${MATCH_MIN_VERIFY}
- Si no hay un solo rostro claro: match=false
- No inventes datos`
            },
            { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
            { inlineData: { mimeType: referencia.mimeType, data: referencia.base64 } }
          ]
        }
      ]
    }),
    GEMINI_TIMEOUT_MS,
    'Gemini'
  )
  const parsed = tryParseJson(response.text ?? '')
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const match = parsed?.match === true && confianza >= MATCH_MIN_VERIFY
  const motivo = String(parsed?.motivo ?? (match ? 'Coincidencia facial' : 'No coincide con la foto del legajo'))
  return { match, confianza, motivo }
}
