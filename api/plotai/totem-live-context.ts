import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  PLOT_CENTER_KNOWLEDGE,
  resolvePlotAIClienteContext
} from './chat-public'
import { beginPlotAiRequest } from './_http'

type Body = {
  userTexts?: string[]
  nombre?: string
  empresa?: string
  dni?: string
  cuit?: string
  op?: string
}

/** Contexto OP/cliente/precios para Gemini Live del tótem (misma fuente que chat-public). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as Body
  } catch {
    res.status(400).json({ error: 'JSON inválido' })
    return
  }

  const userTexts = Array.isArray(body.userTexts)
    ? body.userTexts.map((t) => String(t ?? '').trim()).filter(Boolean).slice(-24)
    : []

  try {
    const resolved = await resolvePlotAIClienteContext({
      userTexts,
      modo: 'totem',
      nombre: body.nombre,
      empresa: body.empresa,
      dni: body.dni,
      cuit: body.cuit,
      op: body.op,
      includePrecios: true
    })

    res.status(200).json({
      success: true,
      plotCenterKnowledge: PLOT_CENTER_KNOWLEDGE,
      ...resolved
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error resolviendo contexto'
    console.error('totem-live-context:', error)
    res.status(500).json({ success: false, error: message })
  }
}
