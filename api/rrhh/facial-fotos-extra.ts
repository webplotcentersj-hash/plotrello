import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginCorsRequest, getSupabaseServerKey, getSupabaseServerUrl } from '../_lib/security'
import { requireStaffSession } from '../_lib/staffAuth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 20

/** Máximo de fotos extra por empleado (además de la de legajo). */
const MAX_EXTRA_POR_EMPLEADO = 2

function staffOk(rol: string): boolean {
  return ['recursos-humanos', 'administracion', 'gerencia', 'admin'].includes(rol)
}

function fotoKeyFromUrl(fotoUrl: string): string {
  return String(fotoUrl || '')
    .trim()
    .replace(/([?&])v=\d+/g, '')
    .replace(/\?$/, '')
}

/**
 * GET: lista fotos extra de enrolamiento facial.
 * POST: agrega una foto extra (url ya subida a Storage).
 * DELETE: quita una foto extra por id.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginCorsRequest(req, res, 'GET, POST, DELETE, OPTIONS')) return

  const staff = requireStaffSession(req, res)
  if (!staff) return
  if (!staffOk(staff.rol)) {
    res.status(403).json({ success: false, error: 'No autorizado' })
    return
  }

  const url = getSupabaseServerUrl()
  const key = getSupabaseServerKey()
  if (!url || !key) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }
  const supabase = createClient(url, key)

  if (req.method === 'GET') {
    const idUsuario = Number(req.query.id_usuario)
    let q = supabase
      .from('rrhh_facial_fotos_extra')
      .select('id, id_usuario, foto_url, foto_key, created_at')
      .order('id_usuario')
      .order('id')
    if (Number.isFinite(idUsuario) && idUsuario > 0) {
      q = q.eq('id_usuario', idUsuario)
    }
    const { data, error } = await q
    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }
    res.status(200).json({ success: true, fotos: data ?? [], max_extra: MAX_EXTRA_POR_EMPLEADO })
    return
  }

  if (req.method === 'POST') {
    const body = req.body as { id_usuario?: number; foto_url?: string }
    const idUsuario = Number(body?.id_usuario)
    const fotoUrl = String(body?.foto_url || '').trim()
    if (!Number.isFinite(idUsuario) || idUsuario <= 0 || !fotoUrl) {
      res.status(400).json({ success: false, error: 'Faltan id_usuario o foto_url' })
      return
    }
    const fotoKey = fotoKeyFromUrl(fotoUrl)

    const { count, error: countErr } = await supabase
      .from('rrhh_facial_fotos_extra')
      .select('id', { count: 'exact', head: true })
      .eq('id_usuario', idUsuario)
    if (countErr) {
      res.status(500).json({ success: false, error: countErr.message })
      return
    }
    if ((count ?? 0) >= MAX_EXTRA_POR_EMPLEADO) {
      res.status(400).json({
        success: false,
        error: `Máximo ${MAX_EXTRA_POR_EMPLEADO} fotos extra por empleado (además del legajo).`
      })
      return
    }

    const staffId = Number(staff.sub)
    const { data, error } = await supabase
      .from('rrhh_facial_fotos_extra')
      .upsert(
        {
          id_usuario: idUsuario,
          foto_url: fotoUrl,
          foto_key: fotoKey,
          created_by: Number.isFinite(staffId) && staffId > 0 ? staffId : null
        },
        { onConflict: 'id_usuario,foto_key' }
      )
      .select('id, id_usuario, foto_url, foto_key, created_at')
      .maybeSingle()

    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }
    res.status(200).json({ success: true, foto: data })
    return
  }

  if (req.method === 'DELETE') {
    const id = Number((req.body as { id?: number })?.id ?? req.query.id)
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ success: false, error: 'Falta id' })
      return
    }
    const { error } = await supabase.from('rrhh_facial_fotos_extra').delete().eq('id', id)
    if (error) {
      res.status(500).json({ success: false, error: error.message })
      return
    }
    res.status(200).json({ success: true })
    return
  }

  res.status(405).json({ success: false, error: 'Method not allowed' })
}
