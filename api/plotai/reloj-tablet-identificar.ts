import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './_http'
import { createClient } from '@supabase/supabase-js'
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

type Body = { selfie_data_url?: string }

type EmpleadoRow = {
  id_usuario: number
  nombre: string
  apellido: string
  foto_url: string | null
  login: string
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
  const selfie = String(body?.selfie_data_url || '').trim()
  if (!selfie) {
    res.status(400).json({ success: false, error: 'selfie_data_url requerido' })
    return
  }

  const selfieParsed = stripDataUrl(selfie)
  if (!selfieParsed) {
    res.status(400).json({ success: false, error: 'selfie_data_url inválido' })
    return
  }

  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const { data: rows, error } = await supabase.rpc('listar_empleados_reloj_tablet')
  if (error) {
    res.status(500).json({ success: false, error: error.message })
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
      success: true,
      match: false,
      mensaje: 'Ningún empleado tiene foto de legajo. Usá búsqueda manual.'
    })
    return
  }

  try {
    const mejor = await identificarEmpleadoRapido(apiKey, selfieParsed, empleados)

    if (!mejor) {
      res.status(200).json({
        success: true,
        match: false,
        confianza: 0,
        mensaje: 'No se reconoció a ningún empleado. Probá de nuevo o buscá manual.'
      })
      return
    }

    res.status(200).json({
      success: true,
      match: true,
      id_usuario: mejor.id_usuario,
      confianza: mejor.confianza,
      nombre: mejor.nombre,
      mensaje: `Identificado: ${mejor.nombre} (${mejor.confianza}%)`
    })
  } catch (e) {
    console.error('identificar reloj tablet:', e)
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error al identificar'
    })
  }
}
