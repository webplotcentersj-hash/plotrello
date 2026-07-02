import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { beginPlotAiRequest } from './plotaiHttp'
import { isPlotCenterBusinessHours, plotCenterBusinessHoursLabel } from '../_lib/plotCenterBusinessHours'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const STAFF_ONLINE_WINDOW_MIN = 3

type EmbedAvailabilityStatus = 'staff' | 'hours' | 'away'

function buildPayload(staffCount: number, withinBusinessHours: boolean) {
  const staffOnline = staffCount > 0
  let status: EmbedAvailabilityStatus = 'away'
  let label = 'Fuera de horario'
  let hint = `PlotAI responde igual. Horario humano: ${plotCenterBusinessHoursLabel()}.`

  if (staffOnline) {
    status = 'staff'
    label = staffCount === 1 ? 'Equipo en línea' : `${staffCount} en línea`
    hint = 'Hay personal del equipo atendiendo el chat ahora.'
  } else if (withinBusinessHours) {
    status = 'hours'
    label = 'Horario de atención'
    hint = 'PlotAI responde al instante. El equipo humano puede demorar unos minutos.'
  }

  return {
    staff_online: staffOnline,
    staff_count: staffCount,
    within_business_hours: withinBusinessHours,
    plotai_available: true,
    status,
    label,
    hint,
    business_hours_label: plotCenterBusinessHoursLabel()
  }
}

/** GET /api/plotai/embed-availability — estado real para el chat embebido. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const withinBusinessHours = isPlotCenterBusinessHours()
  let staffCount = 0

  if (supabase) {
    try {
      const since = new Date(Date.now() - STAFF_ONLINE_WINDOW_MIN * 60_000).toISOString()
      const { count, error } = await supabase
        .from('atencion_staff_presence')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_seen', since)

      if (!error && typeof count === 'number') {
        staffCount = count
      }
    } catch (e) {
      console.error('embed-availability count:', e)
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
  res.status(200).json(buildPayload(staffCount, withinBusinessHours))
}
