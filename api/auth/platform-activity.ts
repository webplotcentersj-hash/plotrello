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

function isPrivateIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  )
}

/** Extrae la IP pública real del cliente detrás de proxies (Vercel/CF). */
function clientIp(req: VercelRequest): string | null {
  const candidates: string[] = []
  const push = (raw: unknown) => {
    if (typeof raw === 'string') {
      raw.split(',').forEach((p) => {
        const t = p.trim().replace(/^::ffff:/, '')
        if (t) candidates.push(t)
      })
    } else if (Array.isArray(raw)) {
      raw.forEach((x) => push(x))
    }
  }

  push(req.headers['cf-connecting-ip'])
  push(req.headers['true-client-ip'])
  push(req.headers['x-real-ip'])
  push(req.headers['x-forwarded-for'])
  push(req.headers['x-vercel-forwarded-for'])

  const publicIp = candidates.find((ip) => !isPrivateIp(ip))
  return publicIp || candidates[0] || null
}

async function lookupGeo(ip: string): Promise<Record<string, unknown> | null> {
  if (!ip || isPrivateIp(ip)) return null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,isp,org,lat,lon,query`
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const j = (await res.json()) as Record<string, unknown>
    if (j.status !== 'success') return null
    return {
      city: j.city ?? null,
      region: j.regionName ?? null,
      country: j.country ?? null,
      isp: j.isp ?? null,
      org: j.org ?? null,
      lat: j.lat ?? null,
      lon: j.lon ?? null,
      query: j.query ?? ip,
      source: 'ip-api'
    }
  } catch {
    return null
  }
}

/**
 * POST /api/auth/platform-activity
 * Registra/enriquece sesión con IP real del servidor + geolocalización aproximada.
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

  const supabase = createClient(supabaseUrl, supabaseKey)
  const ip = clientIp(req)
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null

  try {
    if (action === 'resolve-geo') {
      const targetIp = String(body.ip || ip || '').trim()
      if (!targetIp) {
        res.status(400).json({ error: 'IP requerida' })
        return
      }
      const geo = await lookupGeo(targetIp)
      res.status(200).json({ ok: true, ip: targetIp, geo })
      return
    }

    if (!clientSessionId) {
      res.status(400).json({ error: 'clientSessionId requerido' })
      return
    }

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

    const geo = ip ? await lookupGeo(ip) : null
    const deviceInfo = {
      ...(body.deviceInfo && typeof body.deviceInfo === 'object' ? body.deviceInfo : {}),
      ...(geo ? { geo } : {}),
      serverCapturedAt: new Date().toISOString(),
      serverIp: ip
    }

    const { data, error } = await supabase.rpc('abrir_sesion_plataforma', {
      p_usuario_id: staff.sub,
      p_client_session_id: clientSessionId,
      p_entry_path: body.entryPath ?? null,
      p_user_agent: ua,
      p_ip_address: ip,
      p_device_info: deviceInfo,
      p_kind: 'staff'
    })
    if (error) throw error
    res.status(200).json({ ok: true, sessionId: data, ip, geo })
  } catch (e: any) {
    console.error('platform-activity:', e)
    res.status(500).json({ error: e?.message || 'Error interno' })
  }
}
