import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './plotaiHttp'

type Body = { text?: string }

type ElevenVoice = { voice_id?: string; name?: string }

/**
 * TTS ElevenLabs para el tótem (clave solo en servidor).
 *
 * Obligatorio: ELEVENLABS_API_KEY
 * Voz (una de dos):
 *   - ELEVENLABS_VOICE_ID — ID alfanumérico de la voz
 *   - ELEVENLABS_VOICE_NAME — nombre exacto como en ElevenLabs (ej. "Antonio"); el servidor lo resuelve vía API
 *
 * Dónde ver el Voice ID en la web de ElevenLabs:
 *   Voices / Voice library → abrí la voz → menú ⋮ o "Settings" → "Voice ID" para copiar.
 *   O en la URL: ...?voice_id=XXXXXXXX (el valor después de voice_id=).
 *
 * Opcionales: ELEVENLABS_MODEL_ID (default eleven_multilingual_v2),
 * ELEVENLABS_STABILITY, ELEVENLABS_SIMILARITY (0–1).
 */

let cachedVoiceResolve: { key: string; voiceId: string } | null = null

async function resolveVoiceId(apiKey: string): Promise<{ voiceId: string | null; error?: string }> {
  const fromEnvId = (process.env.ELEVENLABS_VOICE_ID || '').trim()
  if (fromEnvId) return { voiceId: fromEnvId }

  const nameWanted = (process.env.ELEVENLABS_VOICE_NAME || '').trim()
  if (!nameWanted) {
    return {
      voiceId: null,
      error:
        'Definí ELEVENLABS_VOICE_ID o ELEVENLABS_VOICE_NAME (nombre de la voz en ElevenLabs, tal cual aparece en la biblioteca).'
    }
  }

  const cacheKey = `${apiKey.slice(0, 8)}:${nameWanted.toLowerCase()}`
  if (cachedVoiceResolve?.key === cacheKey) return { voiceId: cachedVoiceResolve.voiceId }

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey }
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.error('[elevenlabs-tts] list voices', res.status, t.slice(0, 300))
    return { voiceId: null, error: 'No se pudo listar voces (revisá la API key).' }
  }

  const data = (await res.json().catch(() => ({}))) as { voices?: ElevenVoice[] }
  const voices = Array.isArray(data.voices) ? data.voices : []
  const lower = nameWanted.toLowerCase()

  const exact = voices.find((v) => (v.name || '').trim().toLowerCase() === lower)
  const partial =
    exact ||
    voices.find((v) => (v.name || '').trim().toLowerCase().includes(lower)) ||
    voices.find((v) => lower.length >= 3 && (v.name || '').toLowerCase().includes(lower))

  const id = (partial?.voice_id || '').trim()
  if (!id) {
    const sample = voices
      .slice(0, 12)
      .map((v) => v.name)
      .filter(Boolean)
      .join(', ')
    return {
      voiceId: null,
      error: `No hay voz que coincida con "${nameWanted}". Voces disponibles (primeras): ${sample || '(ninguna)'}.`
    }
  }

  cachedVoiceResolve = { key: cacheKey, voiceId: id }
  return { voiceId: id }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', fallback: true })
    return
  }

  const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim()
  if (!apiKey) {
    console.warn('[elevenlabs-tts] Sin ELEVENLABS_API_KEY: no se llama a api.elevenlabs.io')
    res.status(503).json({
      error: 'Falta ELEVENLABS_API_KEY en el servidor (Vercel → Environment Variables).',
      fallback: true
    })
    return
  }

  const { voiceId, error: voiceErr } = await resolveVoiceId(apiKey)
  if (!voiceId) {
    console.warn('[elevenlabs-tts] Voz no resuelta:', voiceErr)
    res.status(503).json({
      error: voiceErr || 'No se pudo resolver la voz (ELEVENLABS_VOICE_ID o ELEVENLABS_VOICE_NAME).',
      fallback: true
    })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as Body
  const text = String(body?.text || '').trim()
  if (!text) {
    res.status(400).json({ error: 'text es requerido', fallback: true })
    return
  }
  if (text.length > 8000) {
    res.status(400).json({ error: 'texto demasiado largo', fallback: true })
    return
  }

  const modelId = (process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2').trim()
  const stability = clamp01(process.env.ELEVENLABS_STABILITY, 0.45)
  const similarity = clamp01(process.env.ELEVENLABS_SIMILARITY, 0.75)

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarity,
          use_speaker_boost: true
        }
      })
    })

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '')
      console.error('[elevenlabs-tts]', upstream.status, errBody.slice(0, 500))
      res.status(502).json({
        error: 'ElevenLabs rechazó la solicitud',
        fallback: true,
        status: upstream.status
      })
      return
    }

    const arrayBuf = await upstream.arrayBuffer()
    const buf = Buffer.from(arrayBuf)
    console.info(
      '[elevenlabs-tts] Llamada OK a api.elevenlabs.io',
      JSON.stringify({
        bytes: buf.length,
        textChars: text.length,
        voiceIdPrefix: `${voiceId.slice(0, 8)}…`
      })
    )
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(buf)
  } catch (e) {
    console.error('[elevenlabs-tts]', e)
    res.status(500).json({ error: 'Error llamando a ElevenLabs', fallback: true })
  }
}

function clamp01(raw: string | undefined, defaultVal: number): number {
  if (raw === undefined || raw === '') return defaultVal
  const n = Number(raw)
  if (Number.isNaN(n)) return defaultVal
  return Math.min(1, Math.max(0, n))
}
