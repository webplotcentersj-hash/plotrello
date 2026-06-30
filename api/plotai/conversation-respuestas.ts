import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './_http'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

/** GET /api/plotai/conversation-respuestas?conversation_id=123
 * Devuelve las respuestas del staff para que el cliente las vea en el widget.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const conversationId = req.query.conversation_id
  const id = typeof conversationId === 'string' ? parseInt(conversationId, 10) : NaN
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'conversation_id inválido' })
    return
  }

  if (!supabase) {
    res.status(500).json({ error: 'Servicio no disponible' })
    return
  }

  try {
    const { data, error } = await supabase
      .from('atencion_conversaciones')
      .select('respuestas_staff')
      .eq('id', id)
      .single()

    if (error || !data) {
      res.status(200).json({ respuestas_staff: [] })
      return
    }

    const respuestas = Array.isArray((data as any)?.respuestas_staff) ? (data as any).respuestas_staff : []
    res.status(200).json({ respuestas_staff: respuestas })
  } catch (e) {
    console.error('conversation-respuestas:', e)
    res.status(500).json({ error: 'Error al obtener respuestas', respuestas_staff: [] })
  }
}
