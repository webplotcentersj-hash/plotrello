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
const BATCH_SIZE = 8
/** Umbral mínimo para aceptar un candidato en identificación por lote */
export const MATCH_MIN_IDENTIFY = 72
/** Umbral mínimo para verificación 1:1 (manual y auto) */
export const MATCH_MIN_VERIFY = 76
/** Auto: exige verificación 1:1 además del candidato del lote */
export const MATCH_MIN_AUTO = 78
const EARLY_EXIT_CONF = 88
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_TIMEOUT_MS = 22_000

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

export function legajoThumbUrl(url: string): string {
  return String(url || '').trim()
}

async function fetchImageRaw(url: string): Promise<SelfieParsed | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length > 4_000_000) return null
    const mimeType = resp.headers.get('content-type') || 'image/jpeg'
    return { mimeType, base64: buf.toString('base64') }
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
  const parsed = await fetchImageRaw(key)
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
      text: `Sistema de reloj laboral en Argentina.
Hay una FOTO EN VIVO (selfie) y fotos de LEGAJO de referencia (cada una etiquetada con su ID).
¿La persona del selfie coincide con algún empleado de esta lista?

${lista}

Respondé SOLO JSON válido:
{"id_usuario":number|null,"confianza":0-100,"nombre":"apellido nombre"}

Reglas:
- id_usuario solo si confianza >= ${MATCH_MIN_IDENTIFY} y hay coincidencia facial clara
- Si hay duda, varias personas posibles, o rostro poco visible: id_usuario null y confianza baja
- No inventes IDs que no estén en la lista`
    },
    { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } }
  ]

  for (const c of candidatos) {
    parts.push({ text: `Legajo ID ${c.id_usuario} — ${c.nombre}` })
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

  const parsed = tryParseJson(response.text ?? '')
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const id = Number(parsed?.id_usuario)
  const nombre = String(parsed?.nombre ?? '')

  if (!id || Number.isNaN(id) || confianza < MATCH_MIN_IDENTIFY) return null
  if (!candidatos.some((c) => c.id_usuario === id)) return null

  return { id_usuario: id, confianza, nombre: nombre || candidatos.find((c) => c.id_usuario === id)?.nombre || '' }
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
              text: `Reloj laboral. ¿La selfie y la foto de legajo de "${candidato.nombre}" son la misma persona?
Solo JSON: {"match":true|false,"confianza":0-100}`
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

export async function identificarEmpleadoRapido(
  apiKey: string,
  selfie: SelfieParsed,
  empleados: EmpleadoConFotoUrl[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!empleados.length) return null

  let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null

  for (let i = 0; i < empleados.length; i += BATCH_SIZE) {
    const slice = empleados.slice(i, i + BATCH_SIZE)
    const candidatos = await cargarCandidatosLote(slice)
    if (!candidatos.length) continue

    try {
      const hit = await identificarEnLote(apiKey, selfie, candidatos)
      if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
      if (mejor && mejor.confianza >= EARLY_EXIT_CONF) return mejor
    } catch (e) {
      console.warn('lote identificar falló, intento 1:1:', e)
      for (const c of candidatos) {
        try {
          const hit = await compararUnEmpleado(apiKey, selfie, c)
          if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
          if (mejor && mejor.confianza >= EARLY_EXIT_CONF) return mejor
        } catch {
          /* siguiente */
        }
      }
    }
  }

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
Respondé SOLO JSON válido:
{"match":true|false,"confianza":0-100,"motivo":"breve en español"}

Reglas:
- match=true solo si confianza >= ${MATCH_MIN_VERIFY}
- Si no hay un solo rostro claro de frente, o hay más de una persona: match=false
- Si hay duda (gorro, barbijo, mala luz, ángulo extremo), bajá confianza
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
