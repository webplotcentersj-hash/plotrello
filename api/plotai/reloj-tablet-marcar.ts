import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

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

function assertRelojTabletAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expected = String(process.env.RELOJ_TABLET_API_KEY || '').trim()
  if (!expected) return true
  const got = String(req.headers['x-reloj-tablet-key'] || req.headers['X-Reloj-Tablet-Key'] || '').trim()
  if (got !== expected) {
    res.status(401).json({ success: false, error: 'No autorizado (tablet)' })
    return false
  }
  return true
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
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const idUsuario = Number(body?.id_usuario)
  if (!idUsuario || Number.isNaN(idUsuario)) {
    res.status(400).json({ success: false, error: 'id_usuario requerido' })
    return
  }

  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  let fotoUrl: string | null = null
  const selfie = String(body.selfie_data_url || '').trim()
  if (selfie && !body.omitir_foto) {
    fotoUrl = await uploadSelfieTablet(supabase, idUsuario, selfie)
  }

  const marcadoAt = String(body.marcado_at || '').trim() || new Date().toISOString()

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
