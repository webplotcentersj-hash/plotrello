import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  return supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
}

function getBearerToken(req: VercelRequest): string {
  const h = String(req.headers.authorization || '')
  const m = h.match(/^Bearer\s+(.+)$/i)
  return (m?.[1] || '').trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const expected = (process.env.PLOT_LAB_BACKUP_TOKEN || '').trim()
  if (expected) {
    const got = getBearerToken(req)
    if (!got || got !== expected) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ error: 'Supabase no está configurado' })
    return
  }

  const limit = Math.max(1, Math.min(Number(req.query.limitHistorial || 50000) || 50000, 200000))

  try {
    const [ordRes, histRes, usrRes] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').order('fecha_creacion', { ascending: false }),
      supabase.from('historial_movimientos').select('*').order('timestamp', { ascending: false }).limit(limit),
      supabase.from('usuarios').select('*').order('id', { ascending: true })
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

