import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getBearerToken,
  getGeminiServerKey,
  getSupabaseServerKey,
  getSupabaseServerUrl,
  handleOptions,
  isPlotLabSameOrigin,
  isProduction,
  setCorsRestricted
} from '../_lib/security'
import { verifyStaffJwt } from '../_lib/staffJwt'
import { extractCvMetadata, stripDataUrl } from './_cvExtract'

type Body = {
  postulacionId?: number
  dataUrl?: string
  cvUrl?: string
  puestoPostulado?: string
}

async function fetchFileAsBase64(url: string): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    const mimeType = resp.headers.get('content-type') || 'application/pdf'
    return { mimeType, base64: buf.toString('base64') }
  } catch {
    return null
  }
}

/** Extrae metadata de CV con PlotAI (staff o submit interno). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsRestricted(req, res, 'POST, OPTIONS')

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const staff = verifyStaffJwt(getBearerToken(req))
  if (isProduction()) {
    if (staff) {
      if (!['recursos-humanos', 'administracion', 'gerencia'].includes(staff.rol)) {
        res.status(403).json({ success: false, error: 'No autorizado' })
        return
      }
    } else if (!isPlotLabSameOrigin(req)) {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }
  }

  const apiKey = getGeminiServerKey()
  if (!apiKey) {
    res.status(503).json({ success: false, error: 'GEMINI_API_KEY no configurada.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const dataUrl = (body?.dataUrl || '').trim()
  const cvUrl = (body?.cvUrl || '').trim()
  const puestoPostulado = (body?.puestoPostulado || '').trim() || undefined

  let mimeType: string | undefined
  let base64: string | undefined

  if (dataUrl) {
    const parsed = stripDataUrl(dataUrl)
    if (!parsed) {
      res.status(400).json({ success: false, error: 'dataUrl inválido' })
      return
    }
    mimeType = parsed.mimeType
    base64 = parsed.base64
  } else if (cvUrl) {
    const fetched = await fetchFileAsBase64(cvUrl)
    if (!fetched) {
      res.status(400).json({ success: false, error: 'No se pudo leer el CV' })
      return
    }
    mimeType = fetched.mimeType
    base64 = fetched.base64
  } else {
    res.status(400).json({ success: false, error: 'dataUrl o cvUrl requerido' })
    return
  }

  try {
    const data = await extractCvMetadata(apiKey, { mimeType, base64, puestoPostulado })
    if (!data) {
      res.status(502).json({ success: false, error: 'La IA no devolvió datos válidos' })
      return
    }

    const postulacionId = Number(body?.postulacionId)
    if (Number.isFinite(postulacionId) && postulacionId > 0) {
      const supabaseUrl = getSupabaseServerUrl()
      const supabaseKey = getSupabaseServerKey()
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        await supabase.rpc('rrhh_postulacion_set_metadata_ia', {
          p_id: postulacionId,
          p_metadata: data,
          p_score: data.score_plot ?? null
        })
      }
    }

    res.status(200).json({ success: true, data })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error extrayendo CV'
    })
  }
}
