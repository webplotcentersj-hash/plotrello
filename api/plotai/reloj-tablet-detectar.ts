import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './plotaiHttp'
import { assertRelojTabletAuth } from './relojTabletAuth'
import { stripDataUrl } from './reloj-tablet-identify-shared'

export const maxDuration = 25

type Body = { selfie_data_url?: string }

type DetectorResult = {
  ok?: boolean
  personas?: number
  motivo?: string
  ms?: number
  area?: number
  confianza?: number
}

/** Proxy hacia detector YOLO en VPS Hostinger. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const detectorUrl = String(process.env.RELOJ_DETECTOR_URL || '').trim()
  const detectorKey = String(process.env.RELOJ_DETECTOR_API_KEY || '').trim()

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const selfieRaw = String(body?.selfie_data_url || '').trim()
  if (!selfieRaw) {
    res.status(400).json({ success: false, error: 'selfie_data_url requerido' })
    return
  }

  const selfie = stripDataUrl(selfieRaw)
  if (!selfie) {
    res.status(400).json({ success: false, error: 'selfie_data_url inválido' })
    return
  }

  if (!detectorUrl || !detectorKey) {
    res.status(200).json({
      success: true,
      ok: true,
      skipped: true,
      motivo: 'Detector no configurado en Vercel (sigue sin filtro YOLO)'
    })
    return
  }

  try {
    const buffer = Buffer.from(selfie.base64, 'base64')
    const form = new FormData()
    const blob = new Blob([buffer], { type: selfie.mimeType || 'image/jpeg' })
    form.append('file', blob, 'selfie.jpg')

    const resp = await fetch(detectorUrl, {
      method: 'POST',
      headers: { 'X-Detector-Key': detectorKey },
      body: form,
      signal: AbortSignal.timeout(20_000)
    })

    const text = await resp.text()
    let json: DetectorResult = {}
    try {
      json = JSON.parse(text) as DetectorResult
    } catch {
      res.status(502).json({
        success: false,
        error: `Detector respondió mal (HTTP ${resp.status})`
      })
      return
    }

    if (!resp.ok) {
      res.status(502).json({
        success: false,
        error: json.motivo || `Detector HTTP ${resp.status}`
      })
      return
    }

    res.status(200).json({
      success: true,
      ok: Boolean(json.ok),
      personas: json.personas ?? 0,
      motivo: json.motivo || (json.ok ? 'Persona detectada' : 'Sin persona válida'),
      ms: json.ms,
      area: json.area,
      confianza: json.confianza
    })
  } catch (e) {
    console.error('reloj-tablet-detectar proxy:', e)
    res.status(502).json({
      success: false,
      error: e instanceof Error ? e.message : 'No se pudo contactar al detector'
    })
  }
}
