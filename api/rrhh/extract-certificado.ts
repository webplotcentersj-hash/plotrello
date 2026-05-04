import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

type Body = {
  mimeType?: string
  dataUrl?: string
}

function stripDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  const mimeType = m[1]
  const base64 = m[2]
  if (!mimeType || !base64) return null
  return { mimeType, base64 }
}

function tryParseJsonFromModelText(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const stripFences = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    return JSON.parse(stripFences) as Record<string, unknown>
  } catch {
    // continue
  }
  const first = stripFences.indexOf('{')
  const last = stripFences.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const candidate = stripFences.slice(first, last + 1)
    try {
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

/**
 * Extrae fechas de reposo / certificación desde certificado médico o constancia de alumno (imagen o PDF).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiKey()
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'GEMINI_API_KEY no configurada.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const dataUrl = (body?.dataUrl || '').trim()
  if (!dataUrl) {
    res.status(400).json({ success: false, error: 'dataUrl requerido' })
    return
  }

  const parsed = stripDataUrl(dataUrl)
  if (!parsed) {
    res.status(400).json({ success: false, error: 'dataUrl inválido (se espera base64 data:...)' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const isPdf = parsed.mimeType === 'application/pdf'
    const system = `Sos un asistente de RRHH en Argentina. Analizá ${isPdf ? 'un PDF' : 'una imagen'} de certificado médico de reposo o constancia de alumno regular / examen.

REGLAS:
- Devolvé SOLO JSON válido (sin markdown, sin texto extra).
- No inventes fechas: si no se leen, usá null.
- Fechas en formato YYYY-MM-DD.
- dias_reposo_sugeridos: número entero de días de reposo indicados en el documento, si constan; si no, null.
- tipo_documento: "certificado_medico" | "estudiante" | "otro" | null

SCHEMA JSON:
{
  "fecha_inicio": string|null,
  "fecha_fin": string|null,
  "dias_reposo_sugeridos": number|null,
  "tipo_documento": string|null,
  "titulo_detectado": string|null,
  "confidence": number|null,
  "notas": string|null
}

notas: una frase corta con lo que interpretaste (ej. "Reposo 3 días desde 12/03").`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: system },
            { inlineData: { mimeType: parsed.mimeType, data: parsed.base64 } }
          ]
        }
      ]
    } as any)

    const text = String((response as any)?.text ?? '').trim()
    const data = tryParseJsonFromModelText(text)
    if (!data) {
      res.status(502).json({
        success: false,
        error: 'La IA no devolvió JSON válido. Probá con otra foto más nítida.',
        debug_preview: text.slice(0, 240)
      })
      return
    }
    res.status(200).json({ success: true, data })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error extrayendo certificado'
    })
  }
}
