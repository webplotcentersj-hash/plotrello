import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { getGeminiServerKey } from './_http'

type Body = {
  prompt?: string
  aspectRatio?: '1:1' | '16:9' | '9:16'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  const aspectRatio = body?.aspectRatio || '1:1'

  if (!prompt) {
    res.status(400).json({ error: 'prompt es requerido' })
    return
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    // Modelo de generación de imágenes según documentación oficial
    // Opciones: gemini-2.5-flash-image, nano-banana, nano-banana-pro
    // Nota: el acceso puede depender de la cuenta/plan/región
    const model = 'gemini-2.5-flash-image'

    // Construir el prompt mejorado
    const enhancedPrompt = `Genera una imagen de: ${prompt}. Relación de aspecto: ${aspectRatio}.`

    // Llamar a generateContent con responseModalities para IMAGE
    // Según la documentación oficial del SDK @google/genai
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: enhancedPrompt }]
        }
      ],
      config: {
        responseModalities: ['IMAGE']
      }
    } as any)

    // Extraer la imagen de la respuesta
    // La estructura puede variar según la versión del SDK
    let imageData: string | null = null
    let mimeType = 'image/png'

    // Intentar diferentes estructuras de respuesta
    const candidates = (response as any)?.candidates || []
    if (candidates.length > 0) {
      const parts = candidates[0]?.content?.parts || []
      const imagePart = parts.find((p: any) => p?.inlineData?.data)
      
      if (imagePart?.inlineData) {
        imageData = imagePart.inlineData.data
        mimeType = imagePart.inlineData.mimeType || 'image/png'
      }
    }

    // Si no encontramos imagen en candidates, intentar en response directamente
    if (!imageData) {
      const directParts = (response as any)?.response?.candidates?.[0]?.content?.parts || []
      const imagePart = directParts.find((p: any) => p?.inlineData?.data)
      
      if (imagePart?.inlineData) {
        imageData = imagePart.inlineData.data
        mimeType = imagePart.inlineData.mimeType || 'image/png'
      }
    }

    // Si aún no hay imagen, verificar si hay texto de error
    if (!imageData) {
      const textPart = candidates[0]?.content?.parts?.find((p: any) => typeof p?.text === 'string')
      const debugText = textPart?.text || (response as any)?.text || JSON.stringify(response, null, 2)
      
      res.status(502).json({
        success: false,
        provider: 'gemini',
        error:
          'Gemini no devolvió una imagen. Posibles causas: modelo no disponible, falta de acceso, restricción de contenido o región.',
        metadata: { model, size: aspectRatio },
        debugText: debugText?.slice?.(0, 2000),
        hint: 'Verifica que tu API key tenga acceso a generación de imágenes y que el modelo esté disponible en tu región.'
      })
      return
    }

    // Construir data URL
    const dataUrl = `data:${mimeType};base64,${imageData}`

    res.status(200).json({
      success: true,
      provider: 'gemini',
      dataUrl,
      metadata: { model, size: aspectRatio }
    })
  } catch (error: any) {
    console.error('Error en generate-image endpoint:', error)
    
    // Proporcionar mensaje de error más útil
    let errorMessage = error?.message || 'Error generando imagen con Gemini'
    
    if (error?.message?.includes('model') || error?.message?.includes('not found')) {
      errorMessage = 'El modelo de generación de imágenes no está disponible. Verifica que tu API key tenga acceso a esta funcionalidad.'
    } else if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
      errorMessage = 'Se alcanzó el límite de cuota. Intenta más tarde o verifica tu plan de Gemini API.'
    }
    
    res.status(500).json({
      success: false,
      provider: 'gemini',
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    })
  }
}


