import type { Task } from '../types/board'
import { plotLabFetch } from '../utils/plotLabApiOrigin'

export type PlotAiPrediction = {
  has_data: boolean
  sprint_key?: string | null
  snapshots_used?: number
  remaining?: number
  completed_count?: number
  velocity_per_day?: number
  velocity_last7?: number[]
  eta_days?: number | null
  eta_range_days?: { low: number; high: number } | null
}

export async function plotAiRecordSprintSnapshot(tasks: Task[], sprintKey?: string | null) {
  const resp = await plotLabFetch('/api/plotai/sprint-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'sprint-optimizer',
      sprint_key: sprintKey ?? null,
      tasks: tasks.map((t) => ({
        id: t.id,
        status: t.status,
        priority: t.priority,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
        ownerId: t.ownerId,
        storyPoints: t.storyPoints
      }))
    })
  })

  // No romper UX si falla: el optimizador debe funcionar igual.
  if (!resp.ok) return { ok: false as const }
  return { ok: true as const }
}

export async function plotAiGetSprintPrediction(sprintKey?: string | null): Promise<PlotAiPrediction | null> {
  const qs = new URLSearchParams()
  if (sprintKey) qs.set('sprint_key', sprintKey)
  const resp = await plotLabFetch(`/api/plotai/sprint-predict?${qs.toString()}`)
  if (!resp.ok) return null
  const json = (await resp.json().catch(() => null)) as any
  return (json?.prediction as PlotAiPrediction) || null
}

