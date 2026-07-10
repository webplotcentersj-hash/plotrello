import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './plotaiHttp'
import { assertRelojTabletAuth } from './relojTabletAuth'
import { getRelojTabletSupabase } from './relojTabletSupabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  identificarEmpleadoRapido,
  stripDataUrl,
  fetchImageAsBase64Cached,
  verificarParFacial,
  MATCH_MIN_AUTO,
  type EmpleadoConFotoUrl
} from './reloj-tablet-identify-shared'

export const maxDuration = 60

type Body = {
  selfie_data_url?: string
  dispositivo_id?: string
  marcado_at?: string
}

async function uploadSelfieTablet(
  client: SupabaseClient,
  idUsuario: number,
  dataUrl: string
): Promise<string | null> {
  const parsed = stripDataUrl(dataUrl)
  if (!parsed) return null
  const ext = parsed.mimeType.includes('png') ? 'png' : 'jpg'
  const path = `reloj-tablet/${idUsuario}/${Date.now()}.${ext}`
  const buf = Buffer.from(parsed.base64, 'base64')
  const { error } = await client.storage.from('legajos').upload(path, buf, {
    contentType: parsed.mimeType,
    upsert: false
  })
  if (error) {
    console.warn('upload selfie tablet:', error.message)
    return null
  }
  const { data } = client.storage.from('legajos').getPublicUrl(path)
  return data?.publicUrl ?? null
}

type EmpleadoRow = {
  id_usuario: number
  nombre: string
  apellido: string
  foto_url: string | null
  login: string
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

  const supabase = getRelojTabletSupabase()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const selfieRaw = String(body?.selfie_data_url || '').trim()
  if (!selfieRaw) {
    res.status(400).json({ success: false, error: 'selfie_data_url requerido' })
    return
  }

  const selfie = stripDataUrl(selfieRaw)
  if (!selfie) {
    res.status(400).json({ success: false, error: 'selfie_data_url inválido' })
    return
  }

  const marcadoAt = String(body.marcado_at || '').trim() || new Date().toISOString()
  const dispositivoId = String(body.dispositivo_id || 'tablet-reloj-1').trim() || 'tablet-reloj-1'

  const { data: rows, error: listErr } = await supabase.rpc('listar_empleados_reloj_tablet')
  if (listErr) {
    res.status(500).json({ success: false, error: listErr.message })
    return
  }

  const empleados: EmpleadoConFotoUrl[] = (rows as EmpleadoRow[] || [])
    .filter((e) => e.foto_url)
    .map((e) => ({
      id_usuario: e.id_usuario,
      nombre: [e.apellido, e.nombre].filter(Boolean).join(', ') || e.login,
      foto_url: String(e.foto_url)
    }))

  if (!empleados.length) {
    res.status(200).json({
      success: false,
      match: false,
      error: 'Ningún empleado tiene foto de legajo. Pedí a RRHH que carguen las fotos.'
    })
    return
  }

  try {
    const hit = await identificarEmpleadoRapido(apiKey, selfie, empleados)
    if (!hit) {
      res.status(200).json({
        success: false,
        match: false,
        mensaje: 'No se reconoció a ningún empleado. Probá de nuevo o pedí ayuda a RRHH.'
      })
      return
    }

    const empleadoHit = (rows as EmpleadoRow[]).find((e) => e.id_usuario === hit.id_usuario)
    const fotoLegajo = empleadoHit?.foto_url ? String(empleadoHit.foto_url) : ''
    const referencia = fotoLegajo ? await fetchImageAsBase64Cached(fotoLegajo) : null
    if (!referencia) {
      res.status(200).json({
        success: false,
        match: false,
        mensaje: 'No se pudo verificar la foto del legajo. Usá modo manual o pedí a RRHH.'
      })
      return
    }

    const nombreCompleto = hit.nombre
    const ver = await verificarParFacial(apiKey, selfie, referencia, nombreCompleto)
    if (!ver.match || ver.confianza < MATCH_MIN_AUTO) {
      res.status(200).json({
        success: false,
        match: false,
        confianza: ver.confianza,
        mensaje: ver.match
          ? `Verificación insuficiente (${ver.confianza}%). Parate de frente e intentá de nuevo.`
          : ver.motivo || `No coincide con ${nombreCompleto}. Probá de nuevo.`
      })
      return
    }

    const fotoUrl = await uploadSelfieTablet(supabase, hit.id_usuario, selfieRaw)
    const detalle = `Auto tablet · ident ${hit.confianza}% · verif ${ver.confianza}%`

    const { data, error } = await supabase.rpc('registrar_marcacion_tablet', {
      p_id_usuario: hit.id_usuario,
      p_tipo: null,
      p_hora: marcadoAt,
      p_foto_url: fotoUrl,
      p_confianza: ver.confianza,
      p_detalle: detalle,
      p_dispositivo: dispositivoId
    })

    if (error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }

    res.status(200).json({
      success: true,
      match: true,
      id_usuario: hit.id_usuario,
      confianza: ver.confianza,
      nombre: hit.nombre,
      data
    })
  } catch (e) {
    console.error('marcar-auto reloj tablet:', e)
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error al identificar y marcar'
    })
  }
}
