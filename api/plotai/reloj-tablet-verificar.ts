import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './plotaiHttp'
import { assertRelojTabletAuth } from './relojTabletAuth'
import { getRelojTabletSupabase } from './relojTabletSupabase'
import {
  fetchImageAsBase64Cached,
  stripDataUrl,
  verificarParFacial
} from './reloj-tablet-identify-shared'

export const maxDuration = 30

type Body = {
  id_usuario?: number
  selfie_data_url?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const apiKey = getGeminiServerKey()
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'GEMINI_API_KEY no configurada' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const idUsuario = Number(body?.id_usuario)
  const selfie = String(body?.selfie_data_url || '').trim()
  if (!idUsuario || !selfie) {
    res.status(400).json({ success: false, error: 'id_usuario y selfie_data_url requeridos' })
    return
  }

  const selfieParsed = stripDataUrl(selfie)
  if (!selfieParsed) {
    res.status(400).json({ success: false, error: 'selfie_data_url inválido' })
    return
  }

  const supabase = getRelojTabletSupabase()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const { data: legajo, error: legErr } = await supabase
    .from('legajos_empleados')
    .select('nombre, apellido, foto_url')
    .eq('id_usuario', idUsuario)
    .maybeSingle()

  if (legErr || !legajo) {
    res.status(404).json({ success: false, error: 'Legajo no encontrado' })
    return
  }

  const nombreCompleto = [legajo.apellido, legajo.nombre].filter(Boolean).join(' ')
  const fotoUrl = legajo.foto_url ? String(legajo.foto_url) : ''
  if (!fotoUrl) {
    res.status(200).json({
      success: true,
      match: false,
      confianza: 0,
      mensaje: 'Sin foto de legajo. Pedí a RRHH que carguen tu foto para poder marcar.',
      nombre: nombreCompleto || 'Empleado'
    })
    return
  }

  const referencia = await fetchImageAsBase64Cached(fotoUrl)
  if (!referencia) {
    res.status(200).json({
      success: true,
      match: false,
      confianza: 0,
      mensaje: 'No se pudo leer la foto del legajo. Pedí a RRHH que la vuelvan a cargar.',
      nombre: nombreCompleto || 'Empleado'
    })
    return
  }

  try {
    const ver = await verificarParFacial(apiKey, selfieParsed, referencia, nombreCompleto)
    res.status(200).json({
      success: true,
      match: ver.match,
      confianza: ver.confianza,
      motivo: ver.motivo,
      mensaje: ver.match
        ? `Identidad verificada (${ver.confianza}%)`
        : `No coincide con ${nombreCompleto} (${ver.confianza}%)`,
      nombre: nombreCompleto
    })
  } catch (e) {
    console.error('verificar reloj tablet:', e)
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error al verificar con Gemini'
    })
  }
}
