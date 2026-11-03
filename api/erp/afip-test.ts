import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaffSession } from '../_lib/staffAuth'
import { testAfipConexion } from '../_lib/afip/autorizar'
import { certificadoDelServidor } from '../_lib/afip/certificado'
import { getAfipAccessToken } from '../_lib/afip/client'
import { getSupabaseAdmin, loadAfipConfigResumen } from '../_lib/afip/supabaseAdmin'
import type { AfipConfigResumen } from '../_lib/afip/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  // Solo el vencimiento del certificado: no llama a ARCA ni necesita el token del SDK.
  if (req.body && (req.body as { solo_certificado?: unknown }).solo_certificado) {
    const staff = requireStaffSession(req, res)
    if (!staff) return
    res.status(200).json({ success: true, data: { certificado: certificadoDelServidor() } })
    return
  }

  if (!getAfipAccessToken()) {
    res.status(500).json({
      success: false,
      error: 'AFIP_ACCESS_TOKEN no configurado en el servidor (Vercel / .env.local).'
    })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  try {
    const supabase = getSupabaseAdmin()
    let config: AfipConfigResumen | null = null
    if (supabase) {
      const row = await loadAfipConfigResumen(supabase)
      config = row as AfipConfigResumen
    }

    const result = await testAfipConexion(config)
    res.status(200).json({ success: true, data: { ...result, certificado: certificadoDelServidor() } })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error probando conexión AFIP'
    })
  }
}
