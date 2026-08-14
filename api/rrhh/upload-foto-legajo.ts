import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { beginCorsRequest, getSupabaseServerKey, getSupabaseServerUrl } from '../_lib/security'
import { requireStaffSession } from '../_lib/staffAuth'

export const maxDuration = 30

const ROLES_OK = new Set(['recursos-humanos', 'administracion', 'gerencia', 'admin'])

type Body = {
  id_usuario?: number
  mime_type?: string
  base64?: string
  file_ext?: string
  /** Si true, ruta única (no pisa la foto de legajo). Para enrolamiento facial multi-foto. */
  facial_extra?: boolean
}

function stripDataUrl(raw: string): { mime: string; base64: string } | null {
  const m = String(raw || '').match(/^data:([^;]+);base64,(.+)$/i)
  if (m) return { mime: m[1], base64: m[2] }
  if (/^[A-Za-z0-9+/=]+$/.test(String(raw || '').slice(0, 80))) {
    return { mime: 'image/jpeg', base64: String(raw) }
  }
  return null
}

/** Sube foto de legajo con service role (bypass RLS Storage). Solo staff RRHH/admin. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginCorsRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  if (!ROLES_OK.has(String(staff.rol || '').toLowerCase())) {
    res.status(403).json({ success: false, error: 'No autorizado para subir fotos de legajo' })
    return
  }

  const url = getSupabaseServerUrl()
  const key = getSupabaseServerKey()
  if (!url || !key) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const idUsuario = Number(body?.id_usuario)
  if (!idUsuario || Number.isNaN(idUsuario)) {
    res.status(400).json({ success: false, error: 'id_usuario requerido' })
    return
  }

  const rawB64 = String(body?.base64 || '').trim()
  if (!rawB64) {
    res.status(400).json({ success: false, error: 'base64 requerido' })
    return
  }

  const parsed = stripDataUrl(rawB64.includes('base64,') ? rawB64 : `data:${body.mime_type || 'image/jpeg'};base64,${rawB64}`)
  if (!parsed) {
    res.status(400).json({ success: false, error: 'Imagen inválida' })
    return
  }

  const mime = String(body.mime_type || parsed.mime || 'image/jpeg').toLowerCase()
  if (!mime.startsWith('image/')) {
    res.status(400).json({ success: false, error: 'Solo se permiten imágenes' })
    return
  }

  let buf: Buffer
  try {
    buf = Buffer.from(parsed.base64, 'base64')
  } catch {
    res.status(400).json({ success: false, error: 'base64 inválido' })
    return
  }

  if (buf.length < 100) {
    res.status(400).json({ success: false, error: 'Imagen vacía o corrupta' })
    return
  }
  if (buf.length > 10 * 1024 * 1024) {
    res.status(400).json({ success: false, error: 'La imagen supera 10MB' })
    return
  }

  const extRaw = String(body.file_ext || mime.split('/')[1] || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ext = extRaw === 'jpeg' ? 'jpg' : extRaw || 'jpg'
  const facialExtra = Boolean(body.facial_extra)
  // Legajo: un archivo fijo por empleado. Extras faciales: path único (si no, el upsert
  // pisa el legajo y el foto_key queda igual → siempre 1 fila en rrhh_facial_fotos_extra).
  const path = facialExtra
    ? `empleados/facial/${idUsuario}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    : `empleados/${idUsuario}.${ext}`

  const supabase = createClient(url, key)
  const { error: uploadError } = await supabase.storage.from('legajos').upload(path, buf, {
    contentType: mime,
    cacheControl: '3600',
    upsert: !facialExtra
  })

  if (uploadError) {
    res.status(500).json({ success: false, error: uploadError.message })
    return
  }

  const { data: urlData } = supabase.storage.from('legajos').getPublicUrl(path)
  const publicUrl = urlData?.publicUrl
  if (!publicUrl) {
    res.status(500).json({ success: false, error: 'No se pudo obtener la URL pública' })
    return
  }

  // Cache-bust para que la UI no muestre la foto vieja
  const withBust = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`

  res.status(200).json({ success: true, url: withBust, path })
}
