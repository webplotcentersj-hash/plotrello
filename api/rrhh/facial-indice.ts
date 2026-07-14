import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginCorsRequest, getSupabaseServerKey, getSupabaseServerUrl } from '../_lib/security'
import { requireStaffSession } from '../_lib/staffAuth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

type DescriptorRow = {
  id_usuario: number
  nombre: string
  foto_url: string
  foto_key: string
  descriptor: number[]
}

function staffOk(rol: string): boolean {
  return ['recursos-humanos', 'administracion', 'gerencia', 'admin'].includes(rol)
}

/** GET: estado del índice. PUT: reemplaza descriptores (desde panel RRHH). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginCorsRequest(req, res, 'GET, PUT, OPTIONS')) return

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
    const [{ data: rows, error: e1 }, { data: meta, error: e2 }] = await Promise.all([
      supabase
        .from('rrhh_facial_descriptores')
        .select('id_usuario, nombre, foto_url, foto_key, indexed_at')
        .order('id_usuario'),
      supabase.from('rrhh_facial_indice_meta').select('*').eq('id', 1).maybeSingle()
    ])
    if (e1 || e2) {
      res.status(500).json({ success: false, error: e1?.message || e2?.message })
      return
    }
    res.status(200).json({
      success: true,
      meta: meta ?? null,
      descriptores: rows ?? []
    })
    return
  }

  if (req.method === 'PUT') {
    const body = req.body as {
      descriptores?: DescriptorRow[]
      failed_count?: number
      total_fotos?: number
      signature?: string
    }
    const list = Array.isArray(body?.descriptores) ? body.descriptores : null
    if (!list) {
      res.status(400).json({ success: false, error: 'Falta descriptores[]' })
      return
    }

    const clean: Array<{
      id_usuario: number
      nombre: string
      foto_url: string
      foto_key: string
      descriptor: number[]
      indexed_at: string
    }> = []

    for (const row of list) {
      const id = Number(row.id_usuario)
      const desc = Array.isArray(row.descriptor) ? row.descriptor.map(Number) : []
      const foto_url = String(row.foto_url || '').trim()
      const foto_key = String(row.foto_key || foto_url).trim()
      if (!Number.isFinite(id) || id <= 0 || !foto_url || desc.length < 64) continue
      if (desc.some((n) => !Number.isFinite(n))) continue
      clean.push({
        id_usuario: id,
        nombre: String(row.nombre || '').trim() || `Empleado ${id}`,
        foto_url,
        foto_key,
        descriptor: desc,
        indexed_at: new Date().toISOString()
      })
    }

    const { error: delErr } = await supabase
      .from('rrhh_facial_descriptores')
      .delete()
      .gte('id_usuario', 0)
    if (delErr) {
      res.status(500).json({ success: false, error: delErr.message })
      return
    }

    if (clean.length > 0) {
      const { error: insErr } = await supabase.from('rrhh_facial_descriptores').insert(clean)
      if (insErr) {
        res.status(500).json({ success: false, error: insErr.message })
        return
      }
    }

    const failed = Math.max(0, Number(body.failed_count) || 0)
    const total = Math.max(clean.length, Number(body.total_fotos) || clean.length)
    const signature = String(body.signature || '').slice(0, 8000)
    const staffId = Number(staff.sub)
    const builtBy = Number.isFinite(staffId) && staffId > 0 ? staffId : null

    const { error: metaErr } = await supabase.from('rrhh_facial_indice_meta').upsert({
      id: 1,
      signature,
      indexed_count: clean.length,
      failed_count: failed,
      total_fotos: total,
      built_at: new Date().toISOString(),
      built_by: builtBy
    })
    if (metaErr) {
      res.status(500).json({ success: false, error: metaErr.message })
      return
    }

    res.status(200).json({
      success: true,
      indexed: clean.length,
      failed,
      total
    })
    return
  }

  res.status(405).json({ success: false, error: 'Method not allowed' })
}
