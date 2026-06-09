import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getSupabaseServerKey,
  getSupabaseServerUrl,
  handleOptions,
  isPlotLabSameOrigin,
  isProduction,
  setCorsRestricted
} from '../../lib/api/security'
import { isStaffJwtConfigured, signStaffJwt } from '../../lib/api/staffJwt'

type LoginRow = { id: number; nombre: string; rol: string }

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

  if (!isStaffJwtConfigured()) {
    res.status(503).json({
      error: 'PLOT_LAB_STAFF_JWT_SECRET no configurado. Login con JWT deshabilitado en producción.'
    })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  const usuario = String(body.usuario || '').trim()
  const password = String(body.password || '')

  if (!usuario || !password) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' })
    return
  }

  const supabaseUrl = getSupabaseServerUrl()
  const supabaseKey = getSupabaseServerKey()
  if (!supabaseUrl || !supabaseKey) {
    res.status(503).json({ error: 'Supabase no configurado en el servidor' })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await supabase.rpc('login_usuario', {
    p_usuario: usuario,
    p_password: password
  })

  if (error) {
    console.error('staff-login RPC:', error)
    res.status(500).json({ error: 'Error de autenticación' })
    return
  }

  const row = (Array.isArray(data) ? data[0] : data) as LoginRow | null
  if (!row?.id) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    return
  }

  try {
    const token = signStaffJwt({ id: row.id, nombre: row.nombre, rol: row.rol })
    res.status(200).json({
      success: true,
      token,
      usuario: { id: row.id, nombre: row.nombre, rol: row.rol }
    })
  } catch (e) {
    console.error('staff-login sign:', e)
    res.status(503).json({ error: 'No se pudo emitir sesión' })
  }
}
