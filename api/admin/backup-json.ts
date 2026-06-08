import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getSupabaseServerKey,
  getSupabaseServerUrl,
  handleOptions,
  requireBearerSecret,
  setCorsRestricted
} from '../_lib/security'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsRestricted(req, res, 'GET, OPTIONS')
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!requireBearerSecret(req, res, 'PLOT_LAB_BACKUP_TOKEN')) return

  const supabaseUrl = getSupabaseServerUrl()
  const supabaseKey = getSupabaseServerKey()
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
  if (!supabase) {
    res.status(503).json({ error: 'Supabase no está configurado' })
    return
  }

  const limit = Math.max(1, Math.min(Number(req.query.limitHistorial || 50000) || 50000, 200000))

  try {
    const [ordRes, histRes, usrRes] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').order('fecha_creacion', { ascending: false }),
      supabase.from('historial_movimientos').select('*').order('timestamp', { ascending: false }).limit(limit),
      supabase.from('usuarios_publico').select('id, nombre, rol, last_seen').order('id', { ascending: true })
    ])

    const payload = {
      meta: {
        exportadoEn: new Date().toISOString(),
        aplicacion: 'Plot Lab Admin (server backup)',
        versionExport: 1,
        limitHistorial: limit,
        aviso:
          'Snapshot JSON (órdenes, historial de movimientos, usuarios). No sustituye un backup completo de PostgreSQL ni archivos en Storage.'
      },
      ordenes_trabajo: ordRes.data ?? [],
      historial_movimientos: histRes.data ?? [],
      usuarios: usrRes.data ?? [],
      erroresCarga: {
        ordenes: ordRes.error ? ordRes.error.message : null,
        historial: histRes.error ? histRes.error.message : null,
        usuarios: usrRes.error ? usrRes.error.message : null
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=\"plotlab-backup-${new Date().toISOString().slice(0, 10)}.json\"`
    )
    res.status(200).send(JSON.stringify(payload, null, 2))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Error generando backup' })
  }
}

