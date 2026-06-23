import { GoogleGenAI } from '@google/genai'

export type SelfieParsed = { mimeType: string; base64: string }

export type CandidatoReloj = {
  id_usuario: number
  nombre: string
  foto: { mimeType: string; base64: string }
}

const LEGAJO_CACHE = new Map<string, { mimeType: string; base64: string; at: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000
const BATCH_SIZE = 10
const MATCH_MIN = 70
const EARLY_EXIT_CONF = 92

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

export async function fetchImageAsBase64Cached(url: string): Promise<SelfieParsed | null> {
  const key = String(url || '').trim()
  if (!key) return null
  const hit = LEGAJO_CACHE.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { mimeType: hit.mimeType, base64: hit.base64 }
  }
  try {
    const resp = await fetch(key)
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    const mimeType = resp.headers.get('content-type') || 'image/jpeg'
    const base64 = buf.toString('base64')
    LEGAJO_CACHE.set(key, { mimeType, base64, at: Date.now() })
    return { mimeType, base64 }
  } catch {
    return null
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }]
  })

  const parsed = tryParseJson(response.text ?? '')
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const id = Number(parsed?.id_usuario)
  const nombre = String(parsed?.nombre ?? '')

  if (!id || Number.isNaN(id) || confianza < MATCH_MIN) return null
  if (!candidatos.some((c) => c.id_usuario === id)) return null

  return { id_usuario: id, confianza, nombre: nombre || candidatos.find((c) => c.id_usuario === id)?.nombre || '' }
}

/** Identificación por lotes (1 llamada Gemini por hasta 10 empleados) — estable en Vercel. */
export async function identificarEmpleadoRapido(
  apiKey: string,
  selfie: SelfieParsed,
  candidatos: CandidatoReloj[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!candidatos.length) return null

  let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null

  for (let i = 0; i < candidatos.length; i += BATCH_SIZE) {
    const lote = candidatos.slice(i, i + BATCH_SIZE)
    const hit = await identificarEnLote(apiKey, selfie, lote)
    if (hit && (!mejor || hit.confianza > mejor.confianza)) mejor = hit
    if (mejor && mejor.confianza >= EARLY_EXIT_CONF) break
  }

  return mejor
}
