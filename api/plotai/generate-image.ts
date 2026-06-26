import type { VercelRequest, VercelResponse } from '@vercel/node'

type Body = {
  prompt?: string
  aspectRatio?: '1:1' | '16:9' | '9:16'
  /** totem_creative: ilustración vívida para pantalla del tótem PlotAI */
  style?: 'product' | 'totem_creative'
}

function getGeminiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

function setCors(req: VercelRequest, res: VercelResponse): void {
  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS ||
    'https://plotrello.vercel.app,https://trello.plotcenter.com.ar,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

function extractImageFromGeminiJson(payload: unknown): { data: string; mimeType: string } | null {
  const root = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>
  }
  const parts = root?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    const inline = part?.inlineData
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mimeType || 'image/png'
      }
    }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  } catch {
    res.status(400).json({ error: 'JSON inválido' })
    return
  }

  const prompt = (body?.prompt || '').trim()
  const aspectRatio = body?.aspectRatio || '16:9'
  const style = body?.style === 'totem_creative' ? 'totem_creative' : 'product'

  if (!prompt) {
    res.status(400).json({ error: 'prompt es requerido' })
    return
  }

  const model = 'gemini-2.5-flash-image'
  const enhancedPrompt =
    style === 'totem_creative'
      ? `Ilustración digital premium muy atractiva y colorida para mostrar en pantalla táctil de kiosko: ${prompt}. Estilo 3D render amigable o arte digital de alta calidad con colores vivos iluminación cinematográfica composición centrada fondo degradado suave o ambiente mágico detalles pulidos sin marcas de agua sin texto ilegible relación de aspecto ${aspectRatio}.`
      : `Genera una imagen realista de producto gráfico / comunicación visual para imprenta: ${prompt}. Relación de aspecto ${aspectRatio}. Estilo profesional, iluminación natural, sin texto ilegible ni marcas de agua.`

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        })
      }
    )

    const payload = (await upstream.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; status?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }> } }>
    }

    if (!upstream.ok) {
      const apiMessage = payload?.error?.message || `Gemini HTTP ${upstream.status}`
      res.status(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502).json({
        success: false,
        provider: 'gemini',
        error: apiMessage,
        metadata: { model, size: aspectRatio }
      })
      return
    }

    const image = extractImageFromGeminiJson(payload)
    if (!image) {
      const text =
        payload?.candidates?.[0]?.content?.parts
          ?.map((p) => p?.text)
          .filter(Boolean)
          .join('\n') || ''

      res.status(502).json({
        success: false,
        provider: 'gemini',
        error:
          'Gemini no devolvió una imagen. Verificá acceso al modelo de imágenes o probá con otra descripción.',
        metadata: { model, size: aspectRatio },
        debugText: String(text).slice(0, 1500)
      })
      return
    }

    res.status(200).json({
      success: true,
      provider: 'gemini',
      dataUrl: `data:${image.mimeType};base64,${image.data}`,
      metadata: { model, size: aspectRatio }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error generando imagen con Gemini'
    console.error('Error en generate-image endpoint:', error)

    let errorMessage = message
    if (/model|not found|404/i.test(message)) {
      errorMessage =
        'El modelo de generación de imágenes no está disponible en esta API key o región.'
    } else if (/quota|limit|429|RESOURCE_EXHAUSTED/i.test(message)) {
      errorMessage = 'Se alcanzó el límite de cuota de Gemini. Intentá más tarde.'
    }

    res.status(500).json({
      success: false,
      provider: 'gemini',
      error: errorMessage
    })
  }
}
