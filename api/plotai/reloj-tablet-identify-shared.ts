import { GoogleGenAI } from '@google/genai'

export type SelfieParsed = { mimeType: string; base64: string }

export type CandidatoReloj = {
  id_usuario: number
  nombre: string
  foto: { mimeType: string; base64: string }
}

const LEGAJO_CACHE = new Map<string, { mimeType: string; base64: string; at: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000
const CONCURRENCY = 10
const MATCH_MIN = 70
const EARLY_EXIT_CONF = 82

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

async function compararUnCandidato(
  apiKey: string,
  selfie: SelfieParsed,
  candidato: CandidatoReloj
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Reloj laboral. ¿Selfie y legajo de "${candidato.nombre}" son la misma persona? Solo JSON: {"match":true|false,"confianza":0-100}`
          },
          { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
          { inlineData: { mimeType: candidato.foto.mimeType, data: candidato.foto.base64 } }
        ]
      }
    ]
  })

  const parsed = tryParseJson(response.text ?? '')
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const match = parsed?.match === true && confianza >= MATCH_MIN
  if (!match) return null
  return { id_usuario: candidato.id_usuario, confianza, nombre: candidato.nombre }
}

/** Comparación 1:1 en paralelo — más rápido que lotes grandes cuando hay match temprano. */
export async function identificarEmpleadoRapido(
  apiKey: string,
  selfie: SelfieParsed,
  candidatos: CandidatoReloj[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!candidatos.length) return null

  let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null

  for (let i = 0; i < candidatos.length; i += CONCURRENCY) {
    const lote = candidatos.slice(i, i + CONCURRENCY)
    const hits = await Promise.all(lote.map((c) => compararUnCandidato(apiKey, selfie, c)))
    for (const hit of hits) {
      if (!hit) continue
      if (!mejor || hit.confianza > mejor.confianza) mejor = hit
    }
    if (mejor && mejor.confianza >= EARLY_EXIT_CONF) break
  }

  return mejor
}
