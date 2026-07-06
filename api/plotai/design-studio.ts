import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI, Modality } from '@google/genai'
import { beginPlotAiRequest, getGeminiServerKey } from './plotaiHttp'

const DESIGN_STUDIO_SYSTEM = `Eres Plot AI Studio, asistente creativo del equipo de Diseño Gráfico de Plot Center (San Juan, Argentina).
Ayudás con ideas, copy, briefs, estrategias de redes, piezas gráficas, ploteos vehiculares, impresión y atención al cliente.
Respondé en español, claro y profesional. Si no tenés un dato interno, decilo sin inventar.
Plot Center: comunicación visual integral, impresión, diseño, instalaciones, vía pública. Contacto: contacto@plotcenter.com.ar · 2646212163 · 9 de Julio 622 Oeste.`

type ChatHistoryItem = { role: 'user' | 'model'; parts: { text: string }[] }

type Body = {
  action?: string
  message?: string
  history?: ChatHistoryItem[]
  prompt?: string
  text?: string
  voice?: string
  aspectRatio?: string
  imageBase64?: string
  imageMimeType?: string
}

function parseBody(req: VercelRequest): Body {
  try {
    return (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as Body
  } catch {
    return {}
  }
}

function extractImageFromResponse(payload: unknown): { data: string; mimeType: string } | null {
  const root = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>
  }
  for (const part of root?.candidates?.[0]?.content?.parts || []) {
    if (part?.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      }
    }
  }
  return null
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

  const body = parseBody(req)
  const action = String(body.action || '').trim()

  try {
    const ai = new GoogleGenAI({ apiKey })

    if (action === 'chat') {
      const message = String(body.message || '').trim()
      if (!message) {
        res.status(400).json({ error: 'message es requerido' })
        return
      }
      const history = Array.isArray(body.history) ? body.history : []
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history,
        config: { systemInstruction: DESIGN_STUDIO_SYSTEM }
      })
      const response = await chat.sendMessage({ message })
      res.status(200).json({ success: true, text: response.text || '' })
      return
    }

    if (action === 'thinking') {
      const prompt = String(body.prompt || '').trim()
      if (!prompt) {
        res.status(400).json({ error: 'prompt es requerido' })
        return
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          systemInstruction: DESIGN_STUDIO_SYSTEM,
          thinkingConfig: { thinkingBudget: 8192 }
        }
      } as never)
      res.status(200).json({ success: true, text: response.text || '' })
      return
    }

    if (action === 'search') {
      const prompt = String(body.prompt || '').trim()
      if (!prompt) {
        res.status(400).json({ error: 'prompt es requerido' })
        return
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: DESIGN_STUDIO_SYSTEM
        }
      } as never)
      const chunks =
        (response as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: unknown[] } }> })
          .candidates?.[0]?.groundingMetadata?.groundingChunks || []
      res.status(200).json({ success: true, text: response.text || '', chunks })
      return
    }

    if (action === 'image-edit') {
      const prompt = String(body.prompt || '').trim()
      const imageBase64 = String(body.imageBase64 || '').trim()
      const imageMimeType = String(body.imageMimeType || 'image/jpeg').trim()
      if (!prompt || !imageBase64) {
        res.status(400).json({ error: 'prompt e imageBase64 son requeridos' })
        return
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: imageBase64, mimeType: imageMimeType } },
            { text: prompt }
          ]
        },
        config: { responseModalities: [Modality.IMAGE] }
      } as never)
      const image = extractImageFromResponse(response)
      if (!image) {
        res.status(502).json({ error: 'Gemini no devolvió imagen editada.' })
        return
      }
      res.status(200).json({
        success: true,
        dataUrl: `data:${image.mimeType};base64,${image.data}`
      })
      return
    }

    if (action === 'tts') {
      const text = String(body.text || '').trim()
      const voice = String(body.voice || 'Kore').trim()
      if (!text) {
        res.status(400).json({ error: 'text es requerido' })
        return
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
          }
        }
      } as never)
      const base64Audio = (response as {
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>
      }).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      if (!base64Audio) {
        res.status(502).json({ error: 'No se pudo generar audio.' })
        return
      }
      res.status(200).json({ success: true, audioBase64: base64Audio })
      return
    }

    res.status(400).json({ error: `action no soportada: ${action || '(vacía)'}` })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en Plot AI Studio'
    console.error('design-studio:', error)
    res.status(500).json({ error: message })
  }
}
