import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './plotaiHttp'
import { GoogleGenAI } from '@google/genai'

type Campo = 'all' | 'objetivo' | 'brief_publico' | 'estilo_diseno'

type Body = {
  contexto?: string
  campo?: Campo
  indicacion?: string
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
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiServerKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const contexto = (body?.contexto || '').trim()
  if (!contexto) {
    res.status(400).json({ error: 'contexto es requerido' })
    return
  }

  const campo: Campo = body?.campo === 'objetivo' || body?.campo === 'brief_publico' || body?.campo === 'estilo_diseno'
    ? body.campo
    : 'all'
  const indicacion = (body?.indicacion || '').trim()

  const fieldsHint =
    campo === 'all'
      ? '"objetivo_proyecto", "brief_publico", "estilo_diseno"'
      : campo === 'objetivo'
        ? '"objetivo_proyecto"'
        : campo === 'brief_publico'
          ? '"brief_publico"'
          : '"estilo_diseno"'

  const prompt = `Sos asistente de Plot Center (diseño gráfico e imprenta, San Juan, Argentina).
Un cliente completa un BRIEF DE DISEÑO en el portal. Con el contexto abajo, generá texto útil para el equipo de diseño.

CONTEXTO DEL FORMULARIO:
"""
${contexto}
"""

${indicacion ? `INDICACIÓN ADICIONAL DEL CLIENTE:\n${indicacion}\n` : ''}

Respondé ÚNICAMENTE con JSON válido (sin markdown) con estas claves (solo las pedidas: ${fieldsHint}):
{
  "objetivo_proyecto": "2-4 oraciones: para qué es el proyecto, público, mensaje clave",
  "brief_publico": "brief completo para diseño: producto, medidas si se infieren, colores/mensaje si hay pistas, ubicación, cantidades",
  "estilo_diseno": "estilo visual sugerido en pocas palabras (ej: minimalista corporativo, vibrante juvenil)"
}

Reglas:
- Español rioplatense, concreto, profesional.
- No inventes datos que no estén en el contexto; si falta info, dejalo genérico o sugerí preguntar al cliente.
- Si el cliente pidió asesoramiento, el tono puede ser orientador.
- ${campo !== 'all' ? `Solo completá el campo "${campo}"; los demás devolvé cadena vacía "".` : 'Completá los tres campos de forma coherente.'}`

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
      objetivo_proyecto: String(parsed.objetivo_proyecto || '').trim(),
      brief_publico: String(parsed.brief_publico || '').trim(),
      estilo_diseno: String(parsed.estilo_diseno || '').trim()
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al generar con IA'
    res.status(500).json({ error: message })
  }
}
