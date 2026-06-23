import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'

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
const BATCH_SIZE = 12
const MATCH_MIN = 70
const EARLY_EXIT_CONF = 85
const GEMINI_MODEL = 'gemini-2.5-flash'
const THUMB_PX = 224
const GEMINI_TIMEOUT_MS = 28_000

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

/** @deprecated Supabase render devuelve 403 en este proyecto; se usa sharp. */
export function legajoThumbUrl(url: string): string {
  return String(url || '').trim()
}

async function resizeForAi(buf: Buffer): Promise<SelfieParsed> {
  const out = await sharp(buf)
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer()
  return { mimeType: 'image/jpeg', base64: out.toString('base64') }
}

export async function compactSelfieForAi(selfie: SelfieParsed): Promise<SelfieParsed> {
  try {
    const buf = Buffer.from(selfie.base64, 'base64')
    if (buf.length <= 120_000) return selfie
    return await resizeForAi(buf)
  } catch {
    return selfie
  }
}

async function fetchImageRaw(url: string): Promise<SelfieParsed | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length > 6_000_000) return null
    return await resizeForAi(buf)
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
- id_usuario solo si confianza >= ${MATCH_MIN} y hay coincidencia facial clara
- Si hay duda, bajá confianza o devolvé id_usuario null
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

  if (!id || Number.isNaN(id) || confianza < MATCH_MIN) return null
  if (!candidatos.some((c) => c.id_usuario === id)) return null

  return { id_usuario: id, confianza, nombre: nombre || candidatos.find((c) => c.id_usuario === id)?.nombre || '' }
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

/** Carga miniaturas por lote y compara en Gemini (liviano para Vercel). */
export async function identificarEmpleadoRapido(
  apiKey: string,
  selfie: SelfieParsed,
  empleados: EmpleadoConFotoUrl[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!empleados.length) return null

  const selfieAi = await compactSelfieForAi(selfie)
  let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null

  for (let i = 0; i < empleados.length; i += BATCH_SIZE) {
    const slice = empleados.slice(i, i + BATCH_SIZE)
    const candidatos = await cargarCandidatosLote(slice)
    if (!candidatos.length) continue

    const hit = await identificarEnLote(apiKey, selfieAi, candidatos)
    if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
    if (mejor && mejor.confianza >= EARLY_EXIT_CONF) break
  }

  return mejor
}
