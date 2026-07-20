import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getSupabaseServerKey,
  getSupabaseServerUrl,
  handleOptions,
  isPlotLabSameOrigin,
  isProduction,
  setCorsRestricted
} from '../_lib/security'
import { requireStaffSession } from '../_lib/staffAuth'

function clientIp(req: VercelRequest): string | null {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0]?.trim() || null
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).split(',')[0]?.trim() || null
  const real = req.headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  return null
}

/**
 * POST /api/auth/platform-activity
 * Enriquecer sesión con IP del servidor (opcional; el front ya registra vía RPC).
 * body: { clientSessionId, entryPath?, deviceInfo?, action?: 'start'|'ping'|'end' }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsRestricted(req, res, 'POST, OPTIONS')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (isProduction() && !isPlotLabSameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  const supabaseUrl = getSupabaseServerUrl()
  const supabaseKey = getSupabaseServerKey()
  if (!supabaseUrl || !supabaseKey) {
    res.status(503).json({ error: 'Supabase no configurado' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const clientSessionId = String(body.clientSessionId || '').trim()
  const action = String(body.action || 'start')
  if (!clientSessionId) {
    res.status(400).json({ error: 'clientSessionId requerido' })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const ip = clientIp(req)
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null

  try {
    if (action === 'ping') {
      const { error } = await supabase.rpc('ping_sesion_plataforma', {
        p_usuario_id: staff.sub,
        p_client_session_id: clientSessionId
      })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }
    if (action === 'end') {
      const { error } = await supabase.rpc('cerrar_sesion_plataforma', {
        p_usuario_id: staff.sub,
        p_client_session_id: clientSessionId
      })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    const { data, error } = await supabase.rpc('abrir_sesion_plataforma', {
      p_usuario_id: staff.sub,
      p_client_session_id: clientSessionId,
      p_entry_path: body.entryPath ?? null,
      p_user_agent: ua,
      p_ip_address: ip,
      p_device_info: body.deviceInfo ?? {},
      p_kind: 'staff'
    })
    if (error) throw error
    res.status(200).json({ ok: true, sessionId: data, ip })
  } catch (e: any) {
    console.error('platform-activity:', e)
    res.status(500).json({ error: e?.message || 'Error interno' })
  }
}
