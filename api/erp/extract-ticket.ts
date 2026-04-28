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
    const system = `Sos un asistente contable. Extraé datos de un ticket/factura/recibo a partir de ${isPdf ? 'un PDF' : 'una imagen'}.

REGLAS:
- Devolvé SOLO JSON válido (sin markdown, sin texto extra).
- Si un campo no está, usá null.
- Números: usá punto decimal. No inventes.
- Fecha en formato YYYY-MM-DD si se puede inferir; si no, null.

SCHEMA JSON:
{
  "fecha": string|null,
  "proveedor": string|null,
  "categoria": string|null,
  "descripcion": string|null,
  "total": number|null,
  "iva": number|null,
  "neto": number|null,
  "moneda": string|null,
  "metodo_pago": string|null,
  "confidence": number|null,
  "raw_text_hint": string|null
}

Categoria: intentá elegir una etiqueta corta tipo: Combustible, Limpieza, Insumos, Servicios, Repuestos, Transporte, Comida, Otros.
Descripcion: una frase corta con lo principal (ej. "Nafta", "Insumos de oficina", "Service", etc.).`

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
    const data = JSON.parse(text) as Record<string, unknown>
    res.status(200).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Error extrayendo ticket' })
  }
}

