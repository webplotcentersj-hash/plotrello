import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './_http'
import { GoogleGenAI } from '@google/genai'

type SesionResumen = {
  fecha: string
  dia: string
  entrada: string
  salida: string
  horas: number
  extra: number
  anomalia: string | null
}

type EmpleadoResumen = {
  nombre: string
  departamento: string
  totalHoras: number
  totalExtra: number
  diasTrabajados: number
  anomalias: number
  sesionesAnomalas?: SesionResumen[]
}

type Body = {
  empleados?: EmpleadoResumen[]
  periodo?: string
  config?: {
    jornadaLunVie?: number
    jornadaSab?: number
    domingoTodoExtra?: boolean
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiServerKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const empleados = Array.isArray(body?.empleados) ? body.empleados : []
  if (!empleados.length) {
    res.status(400).json({ error: 'empleados es requerido' })
    return
  }

  const periodo = (body?.periodo || '').trim()
  const cfg = body?.config || {}
  const reglaJornada = `Jornada normal: ${cfg.jornadaLunVie ?? 9}h lun-vie, ${cfg.jornadaSab ?? 5}h sábado${cfg.domingoTodoExtra ? ', domingo todo extra' : ''}.`

  const tabla = empleados
    .map((e) => {
      const anomalas = (e.sesionesAnomalas || [])
        .slice(0, 8)
        .map((s) => `    · ${s.fecha} (${s.dia}): ${s.anomalia || 'ok'} [${s.entrada || '—'} → ${s.salida || '—'}]`)
        .join('\n')
      return `- ${e.nombre} (${e.departamento || 's/d'}): ${e.totalHoras}h totales, ${e.totalExtra}h extra, ${e.diasTrabajados} días, ${e.anomalias} anomalías${anomalas ? `\n${anomalas}` : ''}`
    })
    .join('\n')

  const prompt = `Sos analista de Recursos Humanos de Plot Center (San Juan, Argentina). Analizá la asistencia del reloj biométrico${periodo ? ` del período ${periodo}` : ''}.

${reglaJornada}
Las horas y horas extra YA están calculadas; no recalcules números, usá los dados.

DATOS POR EMPLEADO:
${tabla}

Generá un informe profesional en español rioplatense, en markdown, con:
1. **Resumen general** (cantidad de empleados, horas y extras totales aproximadas, panorama).
2. **Horas extra** — quiénes acumulan más y posibles motivos.
3. **Anomalías a revisar** — empleados que olvidan marcar entrada/salida o tienen turnos raros; priorizá los que más anomalías tienen.
4. **Recomendaciones** accionables para el área de RRHH.

Sé concreto y breve. No inventes datos que no estén arriba.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    } as any)

    const text =
      (response as { text?: string })?.text ??
      (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        ?.candidates?.[0]?.content?.parts?.map((p) => p?.text)
        .filter(Boolean)
        .join('\n') ??
      ''

    const informe = String(text || '').trim()
    if (!informe) {
      res.status(502).json({ error: 'La IA no devolvió contenido.' })
      return
    }
    res.status(200).json({ informe })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al generar con IA'
    res.status(500).json({ error: message })
  }
}
