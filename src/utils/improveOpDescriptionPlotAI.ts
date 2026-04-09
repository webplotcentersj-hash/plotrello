import { generateContent } from '../services/plotAIService'
import { formatPlotAITodayReferenceParagraph } from './plotAIPromptToday'

function buildImproveDescriptionPrefix(): string {
  return `${formatPlotAITodayReferenceParagraph()}

Sos un redactor técnico para una empresa de producción gráfica (diseño, impresión, taller, instalaciones).
Vas a recibir la descripción actual de una orden de producción (OP) y, si existe, contexto (cliente, número OP, sectores, fragmento de brief).

Devolvé ÚNICAMENTE el texto mejorado de la descripción, en español (Argentina), claro para operarios y coordinación.

Reglas:
- Conservá todos los datos concretos del texto y del contexto (medidas, cantidades, materiales, fechas, nombres); no inventes datos.
- Mejorá redacción, orden y claridad; podés usar viñetas con guiones o párrafos cortos.
- Si no hay descripción pero sí contexto, redactá un borrador profesional con lo disponible.
- Sin saludos, sin título tipo "Descripción mejorada", sin comillas que envuelvan todo el texto.`
}

function sanitizeImprovedDescription(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '')
  }
  return t.trim()
}

export type ImproveOpDescriptionInput = {
  currentDescription: string
  clientOrTitle?: string
  opNumber?: string
  sector?: string
  briefExcerpt?: string
}

export async function improveOpDescriptionWithPlotAI(input: ImproveOpDescriptionInput): Promise<string> {
  const { currentDescription, clientOrTitle, opNumber, sector, briefExcerpt } = input
  const ctx = [
    opNumber && `Número OP: ${opNumber}`,
    clientOrTitle && `Cliente / referencia: ${clientOrTitle}`,
    sector && `Sectores: ${sector}`,
    briefExcerpt && `Fragmento de brief u observaciones:\n${briefExcerpt.slice(0, 1200)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const hasDesc = currentDescription.trim().length > 0
  const body = hasDesc
    ? `Descripción actual:\n${currentDescription.trim()}`
    : 'No hay descripción cargada. Generá un borrador profesional con el contexto que sigue.'

  const contents = ctx ? `${body}\n\n---\nContexto:\n${ctx}` : body

  const raw = await generateContent({
    contents,
    extraContextPrefix: buildImproveDescriptionPrefix(),
    useCompleteContext: false,
    useMemory: false,
    learnFromResponse: false,
    includeAppManual: false,
  })

  return sanitizeImprovedDescription(raw)
}
