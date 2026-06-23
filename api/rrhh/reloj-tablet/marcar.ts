import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertRelojTabletAuth, getSupabaseService, uploadSelfieTablet } from './_shared'

type Body = {
  id_usuario?: number
  tipo?: 'entrada' | 'salida'
  selfie_data_url?: string
  confianza?: number
  detalle?: string
  dispositivo_id?: string
  omitir_foto?: boolean
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

  const supabase = getSupabaseService()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  let fotoUrl: string | null = null
  const selfie = String(body.selfie_data_url || '').trim()
  if (selfie && !body.omitir_foto) {
    fotoUrl = await uploadSelfieTablet(supabase, idUsuario, selfie)
  }

  const { data, error } = await supabase.rpc('registrar_marcacion_tablet', {
    p_id_usuario: idUsuario,
    p_tipo: body.tipo ?? null,
    p_hora: new Date().toISOString(),
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
