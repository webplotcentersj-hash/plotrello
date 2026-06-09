import { GoogleGenAI } from '@google/genai'

export type CvMetadataIa = {
  nombre_detectado?: string | null
  email_detectado?: string | null
  telefono_detectado?: string | null
  resumen?: string | null
  experiencia_anios?: number | null
  habilidades?: string[]
  educacion?: string | null
  idiomas?: string[]
  puesto_sugerido?: string | null
  score_plot?: number | null
  fortalezas_plot?: string[]
  gaps_plot?: string[]
  confidence?: number | null
  notas?: string | null
}

const PLOT_FILOSOFIA = `Filosofía Plot Center (San Juan, Argentina):
- Empresa gráfica e industrial multisector: diseño, imprenta, taller gráfico, instalaciones, metalúrgica, caja y atención al público.
- Valores: calidad, puntualidad, trabajo en equipo, proactividad, orientación al cliente y mejora continua.
- Perfil ideal: responsable, adaptable, comunicativo, con ganas de aprender y resolver problemas en entorno dinámico.`

export function tryParseJsonFromModelText(text: string): Record<string, unknown> | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const stripFences = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    return JSON.parse(stripFences) as Record<string, unknown>
  } catch {
    // continue
  }
  const first = stripFences.indexOf('{')
  const last = stripFences.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(stripFences.slice(first, last + 1)) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

export function stripDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  const mimeType = m[1]
  const base64 = m[2]
  if (!mimeType || !base64) return null
  return { mimeType, base64 }
}

export async function extractCvMetadata(
  apiKey: string,
  opts: { dataUrl?: string; mimeType?: string; base64?: string; puestoPostulado?: string }
): Promise<CvMetadataIa | null> {
  let mimeType = opts.mimeType || 'application/pdf'
  let base64 = opts.base64 || ''

  if (opts.dataUrl) {
    const parsed = stripDataUrl(opts.dataUrl)
    if (!parsed) return null
    mimeType = parsed.mimeType
    base64 = parsed.base64
  }

  if (!base64) return null

  const ai = new GoogleGenAI({ apiKey })
  const puestoCtx = opts.puestoPostulado
    ? `El candidato se postuló para: ${opts.puestoPostulado}.`
    : ''

  const system = `Sos PlotAI, asistente de RRHH de Plot Center en Argentina. Analizá un CV (PDF o imagen).

${PLOT_FILOSOFIA}

${puestoCtx}

REGLAS:
- Devolvé SOLO JSON válido (sin markdown).
- No inventes datos: si no constan, usá null o [].
- score_plot: 0-100 según fit con la filosofía Plot y el puesto postulado.
- fortalezas_plot y gaps_plot: arrays cortos en español rioplatense.

SCHEMA:
{
  "nombre_detectado": string|null,
  "email_detectado": string|null,
  "telefono_detectado": string|null,
  "resumen": string|null,
  "experiencia_anios": number|null,
  "habilidades": string[],
  "educacion": string|null,
  "idiomas": string[],
  "puesto_sugerido": string|null,
  "score_plot": number|null,
  "fortalezas_plot": string[],
  "gaps_plot": string[],
  "confidence": number|null,
  "notas": string|null
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: system },
          { inlineData: { mimeType, data: base64 } }
        ]
      }
    ]
  } as any)

  const text = String((response as any)?.text ?? '').trim()
  const data = tryParseJsonFromModelText(text)
  if (!data) return null
  return data as CvMetadataIa
}

export async function filterPostulacionesWithPlotAI(
  apiKey: string,
  query: string,
  candidates: Array<{
    id: number
    nombre: string
    puesto: string
    resumen?: string | null
    habilidades?: string[]
    score_plot?: number | null
  }>
): Promise<Array<{ id: number; match_score: number; motivo: string }>> {
  if (!candidates.length) return []

  const ai = new GoogleGenAI({ apiKey })
  const listText = candidates
    .map(
      (c) =>
        `- id=${c.id} | ${c.nombre} | puesto=${c.puesto} | score_plot=${c.score_plot ?? '—'} | skills=${(c.habilidades || []).slice(0, 8).join(', ')} | resumen=${(c.resumen || '').slice(0, 200)}`
    )
    .join('\n')

  const prompt = `Sos PlotAI filtrando candidatos para Plot Center.

${PLOT_FILOSOFIA}

Consulta del reclutador: "${query}"

Candidatos:
${listText}

Devolvé SOLO JSON: { "resultados": [ { "id": number, "match_score": 0-100, "motivo": "frase corta" } ] }
Ordená por match_score descendente. Incluí solo candidatos con match_score >= 25.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  } as any)

  const text = String((response as any)?.text ?? '').trim()
  const data = tryParseJsonFromModelText(text)
  const arr = (data?.resultados as Array<{ id: number; match_score: number; motivo: string }>) || []
  return arr.filter((r) => r?.id != null && Number.isFinite(r.match_score))
}
