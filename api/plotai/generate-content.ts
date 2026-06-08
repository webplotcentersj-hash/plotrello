import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { getGeminiServerKey, handleOptions, setCorsRestricted } from '../_lib/security'

type ContentPart = {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

type ContentMessage = {
  role: 'user' | 'model'
  parts: ContentPart[]
}

type Body = {
  model?: string
  contents?: string | ContentMessage[]
}

function quotaErrorMessage(error: unknown): string | null {
  const err = error as { error?: { code?: number; status?: string; message?: string; details?: unknown[] } }
  if (err?.error?.code !== 429 && err?.error?.status !== 'RESOURCE_EXHAUSTED') return null
  const details = err.error.details || []
  const quotaInfo = details.find((d) => (d as { ['@type']?: string })['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure') as
    | { violations?: Array<{ quotaValue?: string }> }
    | undefined
  const retryInfo = details.find((d) => (d as { ['@type']?: string })['@type'] === 'type.googleapis.com/google.rpc.RetryInfo') as
    | { retryDelay?: string }
    | undefined
  const limit = quotaInfo?.violations?.[0]?.quotaValue || 'desconocido'
  const retryDelay = retryInfo?.retryDelay || '30 segundos'
  return `Cuota de API excedida (límite ${limit}). Esperá ${retryDelay} o actualizá el plan de Gemini.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsRestricted(req, res)

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiServerKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as Body
    const model = (body.model || 'gemini-2.5-flash').trim()
    const contents = body.contents

    if (contents == null || (typeof contents === 'string' && !contents.trim())) {
      res.status(400).json({ error: 'contents es requerido' })
      return
    }

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model, contents })
    const text = response.text || ''

    if (!text.trim()) {
      res.status(502).json({ error: 'Gemini no devolvió texto.' })
      return
    }

    res.status(200).json({ text })
  } catch (error: unknown) {
    const quotaMsg = quotaErrorMessage(error)
    if (quotaMsg) {
      res.status(429).json({ error: quotaMsg })
      return
    }
    const message = error instanceof Error ? error.message : 'Error interno'
    console.error('generate-content:', error)
    res.status(500).json({ error: message })
  }
}
