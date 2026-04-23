import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Emite un token efímero para iniciar una conversación ElevenLabs Conversational AI (WebRTC recomendado).
 *
 * Requiere: ELEVENLABS_API_KEY (server-side).
 * El frontend NO debe conocer la API key: usa este endpoint y pasa el token a `useConversation().startSession()`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim()
  if (!apiKey) {
    res.status(503).json({
      error: 'Falta ELEVENLABS_API_KEY en el servidor (Vercel → Environment Variables).'
    })
    return
  }

  const body =
    (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as { agentId?: string }

  const agentId = String(body?.agentId || '').trim()
  if (!agentId) {
    res.status(400).json({ error: 'agentId es requerido' })
    return
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { 'xi-api-key': apiKey } }
    )

    const txt = await upstream.text().catch(() => '')
    if (!upstream.ok) {
      console.error('[eleven-convai-token]', upstream.status, txt.slice(0, 500))
      res.status(502).json({ error: 'ElevenLabs rechazó la solicitud', status: upstream.status })
      return
    }

    const data = JSON.parse(txt || '{}') as { token?: string }
    if (!data?.token || typeof data.token !== 'string') {
      res.status(502).json({ error: 'Respuesta inválida de ElevenLabs (sin token).' })
      return
    }

    res.status(200).json({ token: data.token })
  } catch (e) {
    console.error('[eleven-convai-token]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error generando token' })
  }
}

