import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

type Body = {
  prompt?: string
  duration?: number
  aspectRatio?: '16:9' | '9:16' | '1:1'
}

function getEnvKey() {
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
  const duration = Math.max(1, Math.min(Number(body?.duration || 8), 8))
  const aspectRatio = body?.aspectRatio || '16:9'

  if (!prompt) {
    res.status(400).json({ error: 'prompt es requerido' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Video generation (Veo) suele ser LRO y puede no estar disponible para esta key/región.
    // Dejamos una implementación “best effort” y un mensaje claro si no hay soporte.
    const model = 'veo-3.1-generate-preview'

    // @ts-expect-error: SDK puede no tipar generateVideos en esta versión.
    const response = await (ai as any).models.generateVideos?.({
      model,
      prompt,
      config: {
        durationSeconds: duration,
        aspectRatio
      }
    })

    // Si el SDK no tiene generateVideos, devolver explicación
    if (!response) {
      res.status(501).json({
        success: false,
        provider: 'gemini',
        error:
          'La generación de video (Veo) no está disponible desde este runtime/SDK o tu cuenta no tiene acceso. ' +
          'Necesita habilitación del modelo Veo para la API key.'
      })
      return
    }

    // Intentar extraer URL/bytes (depende del SDK)
    const videoUrl =
      response?.videoUrl ||
      response?.output?.[0] ||
      response?.videos?.[0]?.uri ||
      response?.result?.videos?.[0]?.uri

    if (!videoUrl) {
      res.status(502).json({
        success: false,
        provider: 'gemini',
        error:
          'Se ejecutó la solicitud pero no se pudo extraer URL del video. Puede requerir polling/operación asincrónica.'
      })
      return
    }

    res.status(200).json({
      success: true,
      provider: 'gemini',
      url: videoUrl,
      metadata: { model, duration }
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      provider: 'gemini',
      error: error?.message || 'Error generando video con Gemini'
    })
  }
}


