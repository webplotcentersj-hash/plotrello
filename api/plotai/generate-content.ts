import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

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
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS || 'https://plotrello.vercel.app,https://trello.plotcenter.com.ar')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
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
