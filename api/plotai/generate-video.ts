import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './plotaiHttp'
import { GoogleGenAI } from '@google/genai'

type Body = {
  prompt?: string
  duration?: number
  aspectRatio?: '16:9' | '9:16' | '1:1'
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
  const prompt = (body?.prompt || '').trim()
  const duration = Math.max(1, Math.min(Number(body?.duration || 8), 8))
  const aspectRatio = body?.aspectRatio || '16:9'

  if (!prompt) {
    res.status(400).json({ error: 'prompt es requerido' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Video generation con Veo según documentación oficial
    // Modelos disponibles: veo-3-generate-preview, veo-3.1-generate-preview
    // Nota: Veo requiere plan Pro/Ultra y puede no estar disponible en todas las regiones
    const model = 'veo-3.1-generate-preview'

    console.log('🎬 Intentando generar video con Veo:', { model, prompt, duration, aspectRatio })

    // Según la documentación oficial, Veo usa generateContent con responseModalities: ['VIDEO']
    // O puede tener un método específico generateVideos
    try {
      // Intentar primero con generateContent (método estándar)
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Genera un video de: ${prompt}. Duración: ${duration} segundos. Aspecto: ${aspectRatio}.`
              }
            ]
          }
        ],
        config: {
          responseModalities: ['VIDEO'],
          videoConfig: {
            durationSeconds: duration,
            aspectRatio
          }
        }
      } as any)

      // Intentar extraer video de la respuesta
      const candidates = (response as any)?.candidates || []
      const parts = candidates[0]?.content?.parts || []
      const videoPart = parts.find((p: any) => p?.videoData || p?.inlineData?.mimeType?.includes('video'))

      if (videoPart?.videoData || videoPart?.inlineData) {
        const videoData = videoPart.videoData || videoPart.inlineData.data
        const mimeType = videoPart.inlineData?.mimeType || 'video/mp4'
        
        // Convertir a data URL o URL según corresponda
        const videoDataUrl = videoData.startsWith('http') 
          ? videoData 
          : `data:${mimeType};base64,${videoData}`

        res.status(200).json({
          success: true,
          provider: 'gemini',
          url: videoDataUrl,
          dataUrl: videoDataUrl,
          metadata: { model, duration, aspectRatio }
        })
        return
      }
    } catch (contentError: any) {
      console.warn('⚠️ Error con generateContent, intentando método alternativo:', contentError)
      
      // Si falla, puede ser que Veo requiera un método específico o polling
      // Por ahora, informar al usuario sobre las limitaciones
      res.status(501).json({
        success: false,
        provider: 'gemini',
        error:
          'La generación de video con Veo requiere:\n' +
          '- Plan Gemini Pro/Ultra\n' +
          '- Acceso habilitado al modelo Veo\n' +
          '- Disponibilidad en tu región\n\n' +
          'Por ahora, esta funcionalidad puede no estar disponible. ' +
          'Error técnico: ' + (contentError?.message || 'Modelo no disponible'),
        hint: 'Verifica tu plan de Gemini API y la disponibilidad de Veo en tu región.'
      })
      return
    }

    // Si llegamos aquí, no se pudo generar el video
    res.status(502).json({
      success: false,
      provider: 'gemini',
      error:
        'No se pudo generar el video. El modelo Veo puede requerir:\n' +
        '- Operación asincrónica (polling)\n' +
        '- Método específico del SDK\n' +
        '- Acceso especial habilitado'
    })
  } catch (error: any) {
    console.error('❌ Error crítico generando video:', error)
    res.status(500).json({
      success: false,
      provider: 'gemini',
      error: error?.message || 'Error generando video con Gemini',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    })
  }
}


