import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type Body = {
  sprint_key?: string | null
  source?: string | null
  tasks?: Array<{
    id: string
    status?: string | null
    priority?: string | null
    updatedAt?: string | null
    createdAt?: string | null
    ownerId?: string | null
    storyPoints?: number | null
  }>
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!supabase) {
    res.status(500).json({ error: 'Supabase no configurado en el servidor' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const tasks = Array.isArray(body?.tasks) ? body.tasks : []

  const completedStatus = 'almacen-entrega'
  const completedCount = tasks.filter((t) => (t?.status || '') === completedStatus).length
  const taskCount = tasks.length
  const remainingCount = taskCount - completedCount

  const payload = {
    tasks: tasks.map((t) => ({
      id: String(t.id),
      status: t.status ?? null,
      priority: t.priority ?? null,
      updatedAt: t.updatedAt ?? null,
      createdAt: t.createdAt ?? null,
      ownerId: t.ownerId ?? null,
      storyPoints: typeof t.storyPoints === 'number' ? t.storyPoints : null
    }))
  }

  const insert = {
    source: (body?.source || 'sprint-optimizer').toString(),
    sprint_key: body?.sprint_key ? String(body.sprint_key) : null,
    task_count: taskCount,
    completed_count: completedCount,
    remaining_count: remainingCount,
    payload
  }

  const { error } = await supabase.from('plotai_sprint_snapshots').insert(insert as any)
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}

