import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

type Body = {
  especificacion?: string
  articulos?: string[]
  donde_colocados?: string
  digital_o_impresion?: string
  cantidades?: string
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : trimmed
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const especificacion = (body?.especificacion || '').trim()
  if (!especificacion) {
    res.status(400).json({ error: 'especificacion es requerida' })
    return
  }

  const articulos = Array.isArray(body.articulos) ? body.articulos.filter(Boolean) : []
  const donde = (body.donde_colocados || '').trim()
  const formato = (body.digital_o_impresion || '').trim()
  const cantidades = (body.cantidades || '').trim()

  const prompt = `Sos asistente de Plot Center (imprenta y comunicación visual, Argentina).
El cliente arma un pedido desde el portal y escribió una ESPECIFICACIÓN en lenguaje natural.
Artículos ya elegidos en catálogo: ${articulos.length ? articulos.join(', ') : 'sin nombre'}.
${donde ? `Ubicación de uso: ${donde}` : ''}
${formato ? `Formato: ${formato}` : ''}
${cantidades ? `Cantidades: ${cantidades}` : ''}

ESPECIFICACIÓN DEL CLIENTE:
"""
${especificacion}
"""

Respondé ÚNICAMENTE con un JSON válido (sin markdown) con esta forma:
{
  "descripcion_articulo": "texto listo para producción/diseño del artículo principal (2-4 oraciones)",
  "brief_publico": "brief completo para el equipo interno (objetivo, mensaje, ubicación, cantidades si aplican)",
  "estilo_diseno": "estilo visual sugerido en pocas palabras o vacío"
}

Reglas:
- Español rioplatense, concreto, sin inventar datos que el cliente no dijo.
- Si hay varios artículos, enfocá descripcion_articulo en el primero de la lista.
- brief_publico debe ser útil para diseño e imprenta.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    } as any)

    const text =
      (response as { text?: string })?.text ??
      (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        ?.candidates?.[0]?.content?.parts?.map((p) => p?.text)
        .filter(Boolean)
        .join('\n') ??
      ''

    const parsed = extractJson(String(text))
    if (!parsed) {
      res.status(502).json({ error: 'No se pudo interpretar la respuesta de IA.' })
      return
    }

    res.status(200).json({
      descripcion_articulo: String(parsed.descripcion_articulo || '').trim(),
      brief_publico: String(parsed.brief_publico || '').trim(),
      estilo_diseno: String(parsed.estilo_diseno || '').trim()
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al generar con IA'
    res.status(500).json({ error: message })
  }
}
