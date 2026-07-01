import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './plotaiHttp'
import { createClient } from '@supabase/supabase-js'

type SnapshotRow = {
  id: number
  created_at: string
  task_count: number
  completed_count: number
  remaining_count: number
  payload: any
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function stddev(xs: number[]) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!supabase) {
    res.status(500).json({ error: 'Supabase no configurado en el servidor' })
    return
  }

  const sprintKey = typeof req.query.sprint_key === 'string' ? req.query.sprint_key : null
  const limit = clamp(parseInt(String(req.query.limit || '120'), 10) || 120, 10, 400)

  let q = supabase
    .from('plotai_sprint_snapshots')
    .select('id, created_at, task_count, completed_count, remaining_count, payload')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sprintKey) q = q.eq('sprint_key', sprintKey)

  const { data, error } = await q
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const snapshots = (Array.isArray(data) ? data : []) as SnapshotRow[]
  if (!snapshots.length) {
    res.status(200).json({
      ok: true,
      prediction: { has_data: false }
    })
    return
  }

  // Procesar del más antiguo al más nuevo
  const ordered = [...snapshots].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const doneStatus = 'almacen-entrega'

  // 1) Detectar "primer momento" en que una task aparece como DONE en el histórico
  //    Esto nos permite contar throughput por día.
  const firstDoneAtByTaskId = new Map<string, string>()
  for (const s of ordered) {
    const tasks = Array.isArray((s as any)?.payload?.tasks) ? (s as any).payload.tasks : []
    for (const t of tasks) {
      const id = t?.id ? String(t.id) : ''
      if (!id || firstDoneAtByTaskId.has(id)) continue
      if ((t?.status || '') !== doneStatus) continue
      const ts = typeof t?.updatedAt === 'string' && t.updatedAt ? t.updatedAt : s.created_at
      firstDoneAtByTaskId.set(id, ts)
    }
  }

  // 2) Conteo por día (últimos 28 días)
  const now = Date.now()
  const dayKey = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const daily = new Map<string, number>()
  for (const [, ts] of firstDoneAtByTaskId.entries()) {
    const key = dayKey(ts)
    if (!key) continue
    const d = new Date(`${key}T00:00:00Z`).getTime()
    const daysAgo = Math.floor((now - d) / (24 * 60 * 60 * 1000))
    if (daysAgo < 0 || daysAgo > 27) continue
    daily.set(key, (daily.get(key) || 0) + 1)
  }

  // 3) Velocity: promedio últimos 7 días, con intervalo por desviación estándar (simple)
  const last7Keys: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    last7Keys.push(`${yyyy}-${mm}-${dd}`)
  }
  const last7Counts = last7Keys.map((k) => daily.get(k) || 0)
  const v = mean(last7Counts) // tasks/day
  const sd = stddev(last7Counts)

  const latest = ordered[ordered.length - 1]
  const remaining = latest.remaining_count
  const etaDays = v > 0 ? Math.ceil(remaining / v) : null

  // Rango: usar +/- 1 sd (clamp) para no explotar
  const vLow = Math.max(0.05, v - sd)
  const vHigh = v + sd
  const etaLow = vHigh > 0 ? Math.ceil(remaining / vHigh) : null
  const etaHigh = vLow > 0 ? Math.ceil(remaining / vLow) : null

  res.status(200).json({
    ok: true,
    prediction: {
      has_data: true,
      sprint_key: sprintKey,
      snapshots_used: ordered.length,
      remaining,
      completed_count: latest.completed_count,
      velocity_per_day: v,
      velocity_last7: last7Counts,
      eta_days: etaDays,
      eta_range_days: etaLow != null && etaHigh != null ? { low: etaLow, high: etaHigh } : null
    }
  })
}

