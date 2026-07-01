import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getSupabaseServerKey,
  getSupabaseServerUrl,
  beginCorsRequest,
  isPlotLabSameOrigin,
  isProduction
} from '../lib/security'

type Body = {
  nombre?: string
  email?: string
  telefono?: string
  puesto?: string
  categoria_puesto?: string
  slug?: string
  respuestas?: Record<string, unknown>
  resumen?: string
  website?: string
}

/** Postulación desde formulario externo de convocatoria (sin CV). */
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
  const respuestas = body.respuestas || {}

  const resumenParts: string[] = []
  if (typeof respuestas.motivacion_plot === 'string') {
    resumenParts.push(String(respuestas.motivacion_plot).slice(0, 500))
  }

  const formulario = {
    slug: body.slug || '',
    frase_compromiso: respuestas.frase_compromiso ?? '',
    confirmacion_puesto: respuestas.confirmacion_puesto ?? '',
    respuestas,
    resumen:
      (body.resumen || '').trim() ||
      resumenParts.join(' · ') ||
      null
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: id, error } = await supabase.rpc('crear_postulacion_formulario_externo', {
      p_nombre: body.nombre,
      p_email: body.email,
      p_telefono: body.telefono || null,
      p_puesto: body.puesto,
      p_categoria_puesto: body.categoria_puesto || null,
      p_formulario: formulario,
      p_honeypot: body.website || null
    })

    if (error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }

    res.status(200).json({ success: true, data: { id: Number(id) || 0 } })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error al registrar postulación'
    })
  }
}
