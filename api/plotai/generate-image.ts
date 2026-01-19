import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

type Body = {
  prompt?: string
  aspectRatio?: '1:1' | '16:9' | '9:16'
}

function getEnvKey() {
  // Prefer server-side secret (NO VITE_ prefix)
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getEnvKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const prompt = (body?.prompt || '').trim()
  const aspectRatio = body?.aspectRatio || '1:1'

  if (!prompt) {
    res.status(400).json({ error: 'prompt es requerido' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Modelo de generación de imágenes (según docs actuales)
    // Nota: el acceso puede depender de la cuenta/plan/región.
    const model = 'gemini-2.5-flash-image'

    // Pedimos IMAGE+TEXT por si el modelo devuelve texto adicional
    const response = await ai.models.generateContent({
      model,
      // @ts-expect-error: responseModalities puede no estar tipado en esta versión del SDK.
      config: { responseModalities: ['IMAGE', 'TEXT'] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `Genera UNA imagen. Relación de aspecto preferida: ${aspectRatio}.\n` +
                `Prompt:\n${prompt}\n`
            }
          ]
        }
      ]
    } as any)

    // Extraer imagen (cuando viene como inlineData/base64)
    const candidates = (response as any)?.candidates || []
    const parts =
      candidates?.[0]?.content?.parts ||
      (response as any)?.response?.candidates?.[0]?.content?.parts ||
      []

    const imagePart = parts.find((p: any) => p?.inlineData?.data || p?.inlineData?.mimeType)
    const textPart = parts.find((p: any) => typeof p?.text === 'string')

    if (!imagePart?.inlineData?.data) {
      // Si no viene imagen, devolver el texto para debug
      const debugText = textPart?.text || (response as any)?.text || ''
      res.status(502).json({
        success: false,
        provider: 'gemini',
        error:
          'Gemini no devolvió una imagen (posible falta de acceso al modelo, región o restricción de contenido).',
        metadata: { model, size: aspectRatio },
        debugText: debugText?.slice?.(0, 8000)
      })
      return
    }

    const mimeType = imagePart.inlineData.mimeType || 'image/png'
    const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`

    res.status(200).json({
      success: true,
      provider: 'gemini',
      dataUrl,
      metadata: { model, size: aspectRatio }
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      provider: 'gemini',
      error: error?.message || 'Error generando imagen con Gemini'
    })
  }
}


