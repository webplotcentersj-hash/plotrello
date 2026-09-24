import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaffSession } from '../_lib/staffAuth'
import { getSupabaseAdmin } from '../../lib/afip/supabaseAdmin'

/**
 * Paso 26: URL firmada (corta) para ver un documento del alta de cuenta corriente
 * (DNI, estatuto, constancia, domicilio, pagaré). El bucket `cc-documentos` es privado:
 * solo staff con sesión válida obtiene el link.
 */
const BUCKET = 'cc-documentos'
const TTL_SEC = 5 * 60
const PATH_OK = /^cuenta-corriente\/[A-Za-z0-9_\-/.]+$/

type Body = { path?: string; download?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor.' })
    return
  }

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  } catch {
    res.status(400).json({ success: false, error: 'JSON inválido' })
    return
  }

  const path = String(body?.path || '')
  if (!PATH_OK.test(path) || path.includes('..')) {
    res.status(400).json({ success: false, error: 'Documento inválido' })
    return
  }

  const download = typeof body.download === 'string' && body.download.trim() ? body.download.trim() : undefined
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SEC, download ? { download } : undefined)
  if (error || !data?.signedUrl) {
    res.status(404).json({ success: false, error: error?.message || 'No se encontró el documento' })
    return
  }

  res.status(200).json({ success: true, data: { url: data.signedUrl } })
}
