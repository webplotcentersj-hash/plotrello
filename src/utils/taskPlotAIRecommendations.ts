import { generateContent } from '../services/plotAIService'
import type { Task } from '../types/board'

const MAX_CONTEXT_CHARS = 12_000

const PREFIX = `Sos PlotAI asesor para una empresa de producción gráfica (diseño, impresión, taller, instalaciones, metalúrgica, mostrador).
Recibís un resumen estructurado de una orden de trabajo (OP o ficha) que alguien está viendo en modo solo lectura en el tablero.

Tu respuesta debe estar en español (Argentina), tono profesional y accionable. Incluí estas partes con títulos claros en Markdown (##):

1. **Recomendaciones** — qué conviene hacer o revisar ahora según columna, sector, plazos y datos de la ficha.
2. **Ideas** — alternativas de proceso, comunicación con cliente o coordinación interna cuando aplique.
3. **Buenas prácticas** — pautas concretas del rubro (calidad, plazos, materiales, archivos, instalación, etc.) relevantes a este caso.

Reglas:
- No inventes datos que no figuren en el resumen; si falta información, decilo y sugerí qué pedir o registrar.
- No repitas la ficha entera; aportá valor nuevo.
- Si hay reclamo o urgencia, tenelo en cuenta con prioridad.
- Sin saludo ni despedida larga.`

function pushLine(lines: string[], label: string, value: unknown) {
  if (value === null || value === undefined || value === '') return
  if (Array.isArray(value) && value.length === 0) return
  const text = Array.isArray(value) ? value.join(', ') : String(value)
  if (!text.trim()) return
  lines.push(`${label}: ${text}`)
}

/** Texto compacto para que PlotAI recomiende sin enviar la ficha completa por campos vacíos. */
export function buildTaskContextForRecommendations(task: Task, columnLabel: string): string {
  const lines: string[] = []
  pushLine(lines, 'Tipo', task.esFichaNoOP ? 'Ficha (sin OP)' : 'OP')
  pushLine(lines, 'Número', task.opNumber)
  pushLine(lines, 'Cliente / título', task.title)
  pushLine(lines, 'Columna del tablero', columnLabel)
  pushLine(lines, 'Sector asignado', task.assignedSector)
  pushLine(lines, 'Sectores requeridos', task.sectores)
  pushLine(lines, 'Prioridad', task.priority)
  pushLine(lines, 'Impacto', task.impact)
  pushLine(lines, 'Avance %', task.progress)
  pushLine(lines, 'Vencimiento', task.dueDate)
  pushLine(lines, 'Etiquetas', task.tags)
  pushLine(lines, 'Materiales', task.materials)
  pushLine(lines, 'Metros cuadrados', task.metrosCuadrados != null ? `${task.metrosCuadrados} m²` : null)
  pushLine(lines, 'Descripción / resumen', task.summary?.trim() || null)
  pushLine(lines, 'Brief (extracto)', task.briefPublico ? task.briefPublico.slice(0, 2000) : null)
  pushLine(lines, 'Objetivo proyecto', task.objetivoProyecto)
  pushLine(lines, 'Público objetivo', task.publicoObjetivo)
  pushLine(lines, 'Estilo diseño', task.estiloDiseno)
  pushLine(lines, 'Referencias', task.referencias)
  pushLine(lines, 'Tipo producto/servicio', task.tipoProductoServicio)
  pushLine(lines, 'Digital o impresión', task.digitalOImpresion)
  pushLine(lines, 'Cantidades', task.cantidades)
  pushLine(lines, 'Cliente (brief)', task.clienteNombreCompleto)
  pushLine(lines, 'Empresa', task.clienteEmpresa)
  pushLine(lines, 'Pedido web', task.origenPedidoWeb === true ? 'Sí' : null)
  pushLine(lines, 'Urgencia', task.esUrgencia === true ? 'Sí' : null)
  pushLine(lines, 'Entregado', task.entregado === true ? 'Sí' : null)
  pushLine(lines, 'Reclamo activo', task.enReclamo === true ? 'Sí' : null)
  pushLine(lines, 'Motivo reclamo', task.reclamoMotivo)
  pushLine(lines, 'Etapa taller gráfico', task.etapaTallerGrafico)
  pushLine(lines, 'Etapa instalaciones', task.etapaInstalaciones)
  pushLine(lines, 'Etapa taller imprenta', task.etapaTallerImprenta)
  pushLine(lines, 'Etapa impresión digital', task.etapaImpresionDigital)
  pushLine(lines, 'Etapa metalúrgica', task.etapaMetalurgica)
  pushLine(lines, 'Ficha técnica', task.fichaTecnicaCargada === true ? 'Cargada' : task.fichaTecnicaPdfUrl ? 'Hay PDF' : null)
  pushLine(lines, 'Presupuesto enviado cliente', task.presupuestoEnviadoCliente === true ? 'Sí' : null)
  pushLine(lines, 'Estado revisión', task.estadoRevision)

  if (task.subtasks?.length) {
    const st = task.subtasks.map((s) => `${s.title}${s.done ? ' ✓' : ''}`).join(' | ')
    pushLine(lines, 'Subtareas', st.slice(0, 1500))
  }

  let text = lines.join('\n')
  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS) + '\n[... contexto truncado ...]'
  }
  return text
}

export async function fetchPlotAIRecommendationsForTask(task: Task, columnLabel: string): Promise<string> {
  const summary = buildTaskContextForRecommendations(task, columnLabel)
  return generateContent({
    contents: `Resumen de la orden para asesorar:\n${summary}`,
    extraContextPrefix: PREFIX,
    useCompleteContext: false,
    useMemory: false,
    learnFromResponse: false,
    includeAppManual: false,
  })
}
