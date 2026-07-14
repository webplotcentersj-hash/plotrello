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
const CACHE_TTL_MS = 30 * 60 * 1000

/** Umbral mínimo para aceptar un match de lote */
export const MATCH_MIN_IDENTIFY = 60
/** Umbral mínimo para verificación 1:1 (manual) */
export const MATCH_MIN_VERIFY = 65
/** Auto: confianza mínima para marcar */
export const MATCH_MIN_AUTO = 62
const EARLY_EXIT_CONF = 80
/** Máximo de fotos de referencia por request Gemini */
const BATCH_SIZE = 12
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_TIMEOUT_MS = 16_000

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

function extractGeminiText(response: { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): string {
  if (typeof response?.text === 'string' && response.text.trim()) return response.text
  const parts = response?.candidates?.[0]?.content?.parts || []
  return parts.map((p) => p.text || '').join('').trim()
}

/** URL limpia + miniatura Storage (más liviana para Gemini). */
export function legajoThumbUrl(url: string): string {
  let u = String(url || '').trim()
  if (!u) return u
  // Quitar cache-bust ?v=...
  try {
    const parsed = new URL(u)
    parsed.searchParams.delete('v')
    u = parsed.toString()
  } catch {
    u = u.replace(/([?&])v=\d+/g, '').replace(/\?$/, '')
  }
  if (u.includes('/storage/v1/object/public/')) {
    const rendered = u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = rendered.includes('?') ? '&' : '?'
    return `${rendered}${sep}width=256&height=256&resize=contain&quality=65`
  }
  return u
}

async function fetchImageRaw(url: string): Promise<SelfieParsed | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length < 80 || buf.length > 2_500_000) return null
    const mimeType = resp.headers.get('content-type') || 'image/jpeg'
    return { mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg', base64: buf.toString('base64') }
  } catch {
    return null
  }
}

export async function fetchImageAsBase64Cached(url: string): Promise<SelfieParsed | null> {
  const key = String(url || '').trim().replace(/([?&])v=\d+/g, '').replace(/\?$/, '')
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

async function identificarEnLote(
  apiKey: string,
  selfie: SelfieParsed,
  candidatos: CandidatoReloj[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!candidatos.length) return null

  const ai = new GoogleGenAI({ apiKey })
  const lista = candidatos.map((c) => `- ID ${c.id_usuario}: ${c.nombre}`).join('\n')

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Reloj laboral Argentina. Primera imagen = selfie EN VIVO. Luego fotos de LEGAJO etiquetadas.

Empleados:
${lista}

¿Qué ID coincide con el rostro del selfie?
Respondé SOLO JSON: {"id_usuario":number|null,"confianza":0-100,"nombre":"apellido nombre"}

Reglas:
- Elegí UN id si el rostro coincide (aunque cambie peinado, barba, gafas o luz)
- Si no estás seguro o el rostro no es claro: id_usuario null
- No inventes IDs fuera de la lista
- confianza >= ${MATCH_MIN_IDENTIFY} solo si hay match claro`
    },
    { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } }
  ]

  for (const c of candidatos) {
    parts.push({ text: `LEGAJO ID ${c.id_usuario} — ${c.nombre}` })
    parts.push({ inlineData: { mimeType: c.foto.mimeType, data: c.foto.base64 } })
  }

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }]
    }),
    GEMINI_TIMEOUT_MS,
    'Gemini'
  )

  const parsed = tryParseJson(extractGeminiText(response))
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const id = Number(parsed?.id_usuario)
  if (!id || Number.isNaN(id) || confianza < MATCH_MIN_IDENTIFY) return null
  const cand = candidatos.find((c) => c.id_usuario === id)
  if (!cand) return null
  return { id_usuario: id, confianza, nombre: String(parsed?.nombre || cand.nombre) }
}

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
              text: `Reloj laboral. ¿Selfie y foto de legajo de "${candidato.nombre}" son LA MISMA PERSONA?
Ignorá fondo/ropa/luz. Solo JSON: {"match":true|false,"confianza":0-100}`
            },
            { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
            { inlineData: { mimeType: candidato.foto.mimeType, data: candidato.foto.base64 } }
          ]
        }
      ]
    }),
    12_000,
    'Gemini'
  )
  const parsed = tryParseJson(extractGeminiText(response))
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
 * Identifica al empleado: lotes en paralelo (1–2 llamadas Gemini), no N×1:1.
 */
export async function identificarEmpleadoRapido(
  apiKey: string,
  selfie: SelfieParsed,
  empleados: EmpleadoConFotoUrl[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!empleados.length) return null

  const candidatos = await cargarCandidatosLote(empleados)
  if (!candidatos.length) {
    console.warn('identificar: ninguna foto de legajo pudo cargarse')
    return null
  }

  const batches: CandidatoReloj[][] = []
  for (let i = 0; i < candidatos.length; i += BATCH_SIZE) {
    batches.push(candidatos.slice(i, i + BATCH_SIZE))
  }

  // Todos los lotes en paralelo → típico 1–2 requests con ~20 empleados
  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        return await identificarEnLote(apiKey, selfie, batch)
      } catch (e) {
        console.warn('lote facial falló:', e instanceof Error ? e.message : e)
        return null
      }
    })
  )

  let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null
  for (const hit of results) {
    if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
  }

  if (mejor && mejor.confianza >= EARLY_EXIT_CONF) return mejor

  // Si nadie pasó el umbral de lote, reintento 1:1 solo del mejor candidato débil (si hubo signal)
  // o de los 3 primeros del primer lote como fallback lento-corto
  if (!mejor) {
    const probes = candidatos.slice(0, 3)
    for (const c of probes) {
      try {
        const hit = await compararUnEmpleado(apiKey, selfie, c)
        if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
        if (mejor && mejor.confianza >= EARLY_EXIT_CONF) return mejor
      } catch {
        /* next */
      }
    }
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
              text: `Control de asistencia. ¿La selfie y la foto de legajo de "${nombreCompleto}" son la misma persona?
JSON: {"match":true|false,"confianza":0-100,"motivo":"breve"}`
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
  const parsed = tryParseJson(extractGeminiText(response))
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const match = parsed?.match === true && confianza >= MATCH_MIN_VERIFY
  const motivo = String(parsed?.motivo ?? (match ? 'Coincidencia facial' : 'No coincide con la foto del legajo'))
  return { match, confianza, motivo }
}
