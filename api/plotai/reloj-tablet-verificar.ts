import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { fetchImageAsBase64Cached, tryParseJson, stripDataUrl } from './reloj-tablet-identify-shared'

export const maxDuration = 30

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

type Body = {
  id_usuario?: number
  selfie_data_url?: string
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
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

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; base64: string } | null> {
  return fetchImageAsBase64Cached(url)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const apiKey = getGeminiKey()
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

  const fotoUrl = legajo.foto_url ? String(legajo.foto_url) : ''
  if (!fotoUrl) {
    res.status(200).json({
      success: true,
      match: true,
      confianza: 0,
      omitir_verificacion: true,
      mensaje: 'Sin foto de legajo; marcación permitida sin verificación facial.',
      nombre: [legajo.apellido, legajo.nombre].filter(Boolean).join(', ')
    })
    return
  }

  const referencia = await fetchImageAsBase64(fotoUrl)
  if (!referencia) {
    res.status(200).json({
      success: true,
      match: true,
      confianza: 0,
      omitir_verificacion: true,
      mensaje: 'No se pudo leer la foto del legajo; continuá con confirmación manual.',
      nombre: [legajo.apellido, legajo.nombre].filter(Boolean).join(', ')
    })
    return
  }

  const nombreCompleto = [legajo.apellido, legajo.nombre].filter(Boolean).join(' ')

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Sos un sistema de control de asistencia laboral en Argentina.
Compará si la persona de la FOTO EN VIVO (selfie) es la misma persona que la FOTO DE REFERENCIA del legajo de "${nombreCompleto}".
Respondé SOLO JSON válido:
{"match":true|false,"confianza":0-100,"motivo":"breve en español"}

Reglas:
- match=true solo si confianza >= 70
- Si hay duda (gorro, barbijo, mala luz), bajá confianza
- No inventes datos`
            },
            { inlineData: { mimeType: selfieParsed.mimeType, data: selfieParsed.base64 } },
            { inlineData: { mimeType: referencia.mimeType, data: referencia.base64 } }
          ]
        }
      ]
    })

    const text = response.text ?? ''
    const parsed = tryParseJson(text)
    const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
    const match = parsed?.match === true && confianza >= 70
    const motivo = String(parsed?.motivo ?? (match ? 'Coincidencia facial' : 'No coincide con la foto del legajo'))

    res.status(200).json({
      success: true,
      match,
      confianza,
      motivo,
      mensaje: match
        ? `Identidad verificada (${confianza}%)`
        : `No coincide con ${nombreCompleto} (${confianza}%)`,
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
