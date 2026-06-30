import { GoogleGenAI } from '@google/genai'
import { plotLabFetch } from '../utils/plotLabApiOrigin'

export type GeminiContentPart = {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export type GeminiContentMessage = {
  role: 'user' | 'model'
  parts: GeminiContentPart[]
}

export type GeminiContents = string | GeminiContentMessage[]

let devAiClient: GoogleGenAI | null = null

function getDevAiClient(): GoogleGenAI | null {
  const key = import.meta.env.VITE_GEMINI_API_KEY || ''
  if (!key) return null
  if (!devAiClient) {
    try {
      devAiClient = new GoogleGenAI({ apiKey: key })
    } catch {
      devAiClient = null
    }
  }
  return devAiClient
}

async function callGeminiDev(model: string, contents: GeminiContents): Promise<string> {
  const ai = getDevAiClient()
  if (!ai) {
    throw new Error(
      'PlotAI no configurado. En producción: GEMINI_API_KEY en Vercel. En local: vercel dev o VITE_GEMINI_API_KEY.'
    )
  }
  const response = await ai.models.generateContent({ model, contents })
  const text = response.text || ''
  if (!text.trim()) throw new Error('Gemini no devolvió texto.')
  return text
}

/**
 * Llama a Gemini vía /api/plotai/generate-content (servidor).
 * En dev sin API de Vercel, fallback a VITE_GEMINI_API_KEY.
 */
export async function callGeminiGenerateContent(opts: {
  model?: string
  contents: GeminiContents
}): Promise<string> {
  const model = opts.model || 'gemini-2.5-flash'
  const contents = opts.contents

  try {
    const resp = await plotLabFetch('/api/plotai/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, contents })
    })

    if (resp.status === 404) {
      return callGeminiDev(model, contents)
    }

    const raw = await resp.text()
    let json: { text?: string; error?: string } = {}
    try {
      json = raw ? (JSON.parse(raw) as { text?: string; error?: string }) : {}
    } catch {
      if (!resp.ok) {
        throw new Error(raw.slice(0, 200) || `Error Gemini (${resp.status})`)
      }
    }
    if (!resp.ok) {
      throw new Error(json.error || raw.slice(0, 200) || `Error Gemini (${resp.status})`)
    }
    const text = (json.text || '').trim()
    if (!text) throw new Error('Gemini no devolvió texto.')
    return text
  } catch (error) {
    if (import.meta.env.DEV && getDevAiClient()) {
      try {
        return await callGeminiDev(model, contents)
      } catch {
        /* sigue con error original */
      }
    }
    throw error instanceof Error
      ? error
      : new Error('Error al comunicarse con PlotAI en el servidor.')
  }
}

export function isGeminiApiAvailable(): boolean {
  return typeof window !== 'undefined'
}
