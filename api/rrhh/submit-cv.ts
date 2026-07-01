import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getGeminiServerKey,
  getSupabaseServerKey,
  getSupabaseServerUrl,
  beginCorsRequest,
  isPlotLabSameOrigin,
  isProduction
} from '../_lib/security'
import { extractCvMetadata } from './_cvExtract'

const ALLOWED_EXT = ['pdf', 'doc', 'docx']

type Body = {
  nombre?: string
  email?: string
  telefono?: string
  puesto?: string
  categoria_puesto?: string
  mensaje?: string
  cv_url?: string
  cv_nombre?: string
  cv_mime?: string
  website?: string
}

function isValidCvUrl(url: string): boolean {
  if (!url.startsWith('http')) return false
  const lower = url.toLowerCase()
  return lower.includes('/storage/v1/object/public/archivos/cv-postulaciones')
}

/** Recibe postulación pública (CV ya subido a Storage). Valida y persiste + dispara IA async. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginCorsRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  if (isProduction() && !isPlotLabSameOrigin(req)) {
    res.status(403).json({ success: false, error: 'Forbidden' })
    return
  }

  const supabaseUrl = getSupabaseServerUrl()
  const supabaseKey = getSupabaseServerKey()
  if (!supabaseUrl || !supabaseKey) {
    res.status(503).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body

  const cvUrl = (body.cv_url || '').trim()
  const cvNombre = (body.cv_nombre || '').trim()
  const ext = cvNombre.split('.').pop()?.toLowerCase() || ''

  if (!isValidCvUrl(cvUrl)) {
    res.status(400).json({ success: false, error: 'URL de CV no válida' })
    return
  }
  if (ext && !ALLOWED_EXT.includes(ext)) {
    res.status(400).json({ success: false, error: 'Formato de CV no permitido' })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: id, error } = await supabase.rpc('crear_postulacion_cv_public', {
      p_nombre: body.nombre,
      p_email: body.email,
      p_telefono: body.telefono || null,
      p_puesto: body.puesto,
      p_categoria_puesto: body.categoria_puesto || null,
      p_mensaje: body.mensaje || null,
      p_cv_url: cvUrl,
      p_cv_nombre: cvNombre || null,
      p_cv_mime: body.cv_mime || null,
      p_honeypot: body.website || null
    })

    if (error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }

    const postulacionId = Number(id)
    if (postulacionId > 0) {
      const geminiKey = getGeminiServerKey()
      if (geminiKey) {
        void (async () => {
          try {
            const resp = await fetch(cvUrl)
            if (!resp.ok) return
            const buf = Buffer.from(await resp.arrayBuffer())
            const mimeType = resp.headers.get('content-type') || 'application/pdf'
            const data = await extractCvMetadata(geminiKey, {
              mimeType,
              base64: buf.toString('base64'),
              puestoPostulado: body.puesto
            })
            if (data) {
              await supabase.rpc('rrhh_postulacion_set_metadata_ia', {
                p_id: postulacionId,
                p_metadata: data,
                p_score: data.score_plot ?? null
              })
            }
          } catch {
            /* IA opcional; no bloquea el alta */
          }
        })()
      }
    }

    res.status(200).json({ success: true, data: { id: postulacionId } })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error al registrar postulación'
    })
  }
}
