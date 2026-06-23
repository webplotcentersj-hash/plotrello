import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const BATCH_SIZE = 10

type Body = { selfie_data_url?: string }

type EmpleadoRow = {
  id_usuario: number
  nombre: string
  apellido: string
  foto_url: string | null
  login: string
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

function stripDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(stripped) as Record<string, unknown>
  } catch {
    const a = stripped.indexOf('{')
    const b = stripped.lastIndexOf('}')
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(stripped.slice(a, b + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buf = Buffer.from(await resp.arrayBuffer())
    const mimeType = resp.headers.get('content-type') || 'image/jpeg'
    return { mimeType, base64: buf.toString('base64') }
  } catch {
    return null
  }
}

type Candidato = {
  id_usuario: number
  nombre: string
  foto: { mimeType: string; base64: string }
}

async function identificarEnLote(
  apiKey: string,
  selfie: { mimeType: string; base64: string },
  candidatos: Candidato[]
): Promise<{ id_usuario: number; confianza: number; nombre: string } | null> {
  if (!candidatos.length) return null

  const ai = new GoogleGenAI({ apiKey })
  const lista = candidatos.map((c) => `- ID ${c.id_usuario}: ${c.nombre}`).join('\n')

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Sistema de reloj laboral en Argentina.
Hay una FOTO EN VIVO (selfie) y fotos de LEGAJO de referencia (cada una etiquetada con su ID).
¿La persona del selfie coincide con algún empleado de esta lista?

${lista}

Respondé SOLO JSON válido:
{"id_usuario":number|null,"confianza":0-100,"nombre":"apellido nombre"}

Reglas:
- id_usuario solo si confianza >= 70 y hay coincidencia facial clara
- Si hay duda, bajá confianza o devolvé id_usuario null
- No inventes IDs que no estén en la lista`
    },
    { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } }
  ]

  for (const c of candidatos) {
    parts.push({ text: `Legajo ID ${c.id_usuario} — ${c.nombre}` })
    parts.push({ inlineData: { mimeType: c.foto.mimeType, data: c.foto.base64 } })
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }]
  })

  const parsed = tryParseJson(response.text ?? '')
  const confianza = Math.min(100, Math.max(0, Number(parsed?.confianza ?? 0)))
  const id = Number(parsed?.id_usuario)
  const nombre = String(parsed?.nombre ?? '')

  if (!id || Number.isNaN(id) || confianza < 70) return null
  if (!candidatos.some((c) => c.id_usuario === id)) return null

  return { id_usuario: id, confianza, nombre: nombre || candidatos.find((c) => c.id_usuario === id)?.nombre || '' }
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

  const empleados = (rows as EmpleadoRow[] || []).filter((e) => e.foto_url)
  if (!empleados.length) {
    res.status(200).json({
      success: true,
      match: false,
      mensaje: 'Ningún empleado tiene foto de legajo. Usá búsqueda manual.'
    })
    return
  }

  const candidatos: Candidato[] = []
  for (const emp of empleados) {
    const foto = await fetchImageAsBase64(String(emp.foto_url))
    if (!foto) continue
    const nombre = [emp.apellido, emp.nombre].filter(Boolean).join(', ') || emp.login
    candidatos.push({ id_usuario: emp.id_usuario, nombre, foto })
  }

  if (!candidatos.length) {
    res.status(200).json({
      success: true,
      match: false,
      mensaje: 'No se pudieron leer las fotos del legajo.'
    })
    return
  }

  try {
    let mejor: { id_usuario: number; confianza: number; nombre: string } | null = null

    for (let i = 0; i < candidatos.length; i += BATCH_SIZE) {
      const lote = candidatos.slice(i, i + BATCH_SIZE)
      const hit = await identificarEnLote(apiKey, selfieParsed, lote)
      if (hit && (!mejor || hit.confianza > mejor.confianza)) {
        mejor = hit
      }
      if (mejor && mejor.confianza >= 92) break
    }

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
