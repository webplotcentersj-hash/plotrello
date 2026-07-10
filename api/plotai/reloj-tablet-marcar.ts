import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './plotaiHttp'
import { assertRelojTabletAuth } from './relojTabletAuth'
import { getRelojTabletSupabase } from './relojTabletSupabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 30

type Body = {
  id_usuario?: number
  tipo?: 'entrada' | 'salida'
  selfie_data_url?: string
  confianza?: number
  detalle?: string
  dispositivo_id?: string
  omitir_foto?: boolean
  marcado_at?: string
}

function stripDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

async function uploadSelfieTablet(
  client: SupabaseClient,
  idUsuario: number,
  dataUrl: string
): Promise<string | null> {
  const parsed = stripDataUrl(dataUrl)
  if (!parsed) return null
  const ext = parsed.mimeType.includes('png') ? 'png' : 'jpg'
  const path = `reloj-tablet/${idUsuario}/${Date.now()}.${ext}`
  const buf = Buffer.from(parsed.base64, 'base64')
  const { error } = await client.storage.from('legajos').upload(path, buf, {
    contentType: parsed.mimeType,
    upsert: false
  })
  if (error) {
    console.warn('upload selfie tablet:', error.message)
    return null
  }
  const { data } = client.storage.from('legajos').getPublicUrl(path)
  return data?.publicUrl ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const supabase = getRelojTabletSupabase()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const idUsuario = Number(body?.id_usuario)
  if (!idUsuario || Number.isNaN(idUsuario)) {
    res.status(400).json({ success: false, error: 'id_usuario requerido' })
    return
  }

  let fotoUrl: string | null = null
  const selfie = String(body.selfie_data_url || '').trim()
  if (selfie && !body.omitir_foto) {
    fotoUrl = await uploadSelfieTablet(supabase, idUsuario, selfie)
  }

  const marcadoAt = String(body.marcado_at || '').trim() || new Date().toISOString()
  // registrar_marcacion_tablet: fecha del día y tardanzas en America/Argentina/Buenos_Aires

  const { data, error } = await supabase.rpc('registrar_marcacion_tablet', {
    p_id_usuario: idUsuario,
    p_tipo: body.tipo ?? null,
    p_hora: marcadoAt,
    p_foto_url: fotoUrl,
    p_confianza: body.confianza ?? null,
    p_detalle: body.detalle ?? null,
    p_dispositivo: body.dispositivo_id ?? null
  })

  if (error) {
    res.status(400).json({ success: false, error: error.message })
    return
  }

  res.status(200).json({ success: true, data })
}
