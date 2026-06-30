import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './_http'
import { GoogleGenAI } from '@google/genai'

type Body = {
  analysisData?: any
}

function safeDateEsAR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('es-AR')
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
  const analysisData = body?.analysisData
  if (!analysisData || typeof analysisData !== 'object') {
    res.status(400).json({ error: 'analysisData es requerido' })
    return
  }

  try {
    const tasks = Array.isArray(analysisData.tasks) ? analysisData.tasks : []
    const teamMembers = Array.isArray(analysisData.teamMembers) ? analysisData.teamMembers : []
    const workloadByPerson = Array.isArray(analysisData.workloadByPerson) ? analysisData.workloadByPerson : []
    const bottlenecksByColumn = Array.isArray(analysisData.bottlenecksByColumn) ? analysisData.bottlenecksByColumn : []
    const blockedTasks = Array.isArray(analysisData.blockedTasks) ? analysisData.blockedTasks : []
    const suggestions = Array.isArray(analysisData.suggestions) ? analysisData.suggestions : []

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t: any) => t?.status === 'almacen-entrega').length
    const inProgressTasks = tasks.filter((t: any) => !['diseno-grafico', 'almacen-entrega'].includes(t?.status)).length

    const workloadSummary = workloadByPerson
      .map((w: any) => {
        const name = w?.member?.name ?? '—'
        const taskCount = w?.taskCount ?? 0
        const high = w?.highPriorityCount ?? 0
        const avg = w?.avgProgress ?? 0
        const load = w?.workload ?? 0
        return `- ${name}: ${taskCount} tareas, ${high} alta prioridad, ${Math.round(avg)}% progreso promedio, carga: ${Math.round(load)} pts`
      })
      .join('\n')

    const bottlenecks = bottlenecksByColumn
      .filter((b: any) => !!b?.isBottleneck)
      .map((b: any) => `- ${b?.column?.label ?? b?.column?.id ?? '—'}: ${b?.taskCount ?? 0} tareas, ${(b?.avgDays ?? 0).toFixed(1)} días promedio`)
      .join('\n')

    const blockedTasksInfo = blockedTasks
      .map((t: any) => `- ${t?.title ?? '—'} (OP: ${t?.opNumber ?? '—'}): bloqueada desde ${safeDateEsAR(t?.updatedAt)}`)
      .join('\n')

    const suggestionsSummary = suggestions
      .map((s: any, i: number) => `${i + 1}. ${s?.type ?? '—'}: ${s?.taskTitle ?? '—'} - ${s?.reason ?? ''}`)
      .join('\n')

    const flow = Array.isArray(analysisData.columns)
      ? analysisData.columns
      : [] // opcional

    const prompt = `Eres un experto en gestión de proyectos y análisis de sprints. Analiza los siguientes datos de un sprint de producción gráfica e imprenta y genera un informe detallado y profesional en español.

REGLA CLAVE DEL FLUJO (muy importante):
- Cuando un usuario mueve una tarea a otra columna, se considera que FINALIZÓ su trabajo en la etapa/columna anterior (aunque la OP continúe en otra etapa).

CONTEXTO DEL SPRINT:
- Total de tareas: ${totalTasks}
- Tareas completadas: ${completedTasks}
- Tareas en progreso: ${inProgressTasks}
- Miembros del equipo: ${teamMembers.length}

CARGA DE TRABAJO POR PERSONA:
${workloadSummary || '—'}

CUELLOS DE BOTELLA DETECTADOS:
${bottlenecks || 'Ninguno detectado'}

TAREAS BLOQUEADAS:
${blockedTasksInfo || 'Ninguna tarea bloqueada'}

SUGERENCIAS DE OPTIMIZACIÓN:
${suggestionsSummary || 'No hay sugerencias'}

ESTRUCTURA DEL FLUJO DE TRABAJO:
${flow.length ? flow.map((c: any) => `- ${c?.label ?? c?.id ?? '—'}`).join('\n') : '(no provisto)'}

Por favor, genera un informe detallado que incluya:
1. RESUMEN EJECUTIVO
2. ANÁLISIS DE CARGA DE TRABAJO
3. ANÁLISIS DE FLUJO
4. RIESGOS Y BLOQUEOS
5. RECOMENDACIONES ESTRATÉGICAS
6. MÉTRICAS CLAVE

El informe debe ser profesional, claro, accionable y específico para el contexto de producción gráfica e imprenta. Usa formato markdown para mejor legibilidad.`

    const ai = new GoogleGenAI({ apiKey })
    const model = 'gemini-2.5-flash'

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    } as any)

    const text =
      (response as any)?.text ??
      (response as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n') ??
      ''

    if (!text || !String(text).trim()) {
      res.status(500).json({ error: 'Gemini no devolvió texto.' })
      return
    }

    res.status(200).json({ report: String(text) })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Error al generar el informe con Gemini' })
  }
}

