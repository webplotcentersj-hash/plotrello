import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './_http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  identificarEmpleadoRapido,
  stripDataUrl,
  type EmpleadoConFotoUrl
} from './reloj-tablet-identify-shared'

export const maxDuration = 60

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

type Body = {
  selfie_data_url?: string
  dispositivo_id?: string
  marcado_at?: string
}

function assertRelojTabletAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expected = String(process.env.RELOJ_TABLET_API_KEY || '').trim()
  if (!expected) return true
  const got = String(req.headers['x-reloj-tablet-key'] || req.headers['X-Reloj-Tablet-Key'] || '').trim()
  if (got !== expected) {
    res.status(401).json({ success: false, error: 'No autorizado (tablet)' })
    return false
  }
  return true
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
      error: 'Ningún empleado tiene foto de legajo. Usá modo manual.'
    })
    return
  }

  try {
    const hit = await identificarEmpleadoRapido(apiKey, selfie, empleados)
    if (!hit) {
      res.status(200).json({
        success: false,
        match: false,
        mensaje: 'No se reconoció a ningún empleado. Probá de nuevo o usá modo manual.'
      })
      return
    }

    const fotoUrl = await uploadSelfieTablet(supabase, hit.id_usuario, selfieRaw)
    const detalle = `Auto tablet (${hit.confianza}%)`

    const { data, error } = await supabase.rpc('registrar_marcacion_tablet', {
      p_id_usuario: hit.id_usuario,
      p_tipo: null,
      p_hora: marcadoAt,
      p_foto_url: fotoUrl,
      p_confianza: hit.confianza,
      p_detalle: detalle,
      p_dispositivo: body.dispositivo_id ?? 'tablet-reloj-1'
    })

    if (error) {
      res.status(400).json({ success: false, error: error.message })
      return
    }

    res.status(200).json({
      success: true,
      match: true,
      id_usuario: hit.id_usuario,
      confianza: hit.confianza,
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
