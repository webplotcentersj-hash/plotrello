import { generateContent } from '../services/plotAIService'
import { formatPlotAITodayReferenceParagraph } from './plotAIPromptToday'

const MAX_ISSUES = 40

function buildPrefix(): string {
  return `${formatPlotAITodayReferenceParagraph()}

Sos PlotAI, asistente de compras/administración para conciliación bancaria.
Te pasan un resumen de un reporte de conciliación entre extracto bancario y pagos cargados.

Tu respuesta debe estar en español (Argentina), profesional y accionable, en Markdown con títulos (##):

1. **Diagnóstico** — qué está pasando y qué significa el resultado.
2. **Acciones recomendadas** — pasos concretos para saldar o corregir.
3. **Reglas de matching** — qué datos conviene completar (comprobante, referencia, banco/cuenta, fechas).
4. **Chequeos de riesgo** — duplicados, importes parciales, comisiones/impuestos, movimientos no-pago.

Reglas:
- No inventes datos que no figuren en el resumen.
- Si el estado es SALDADO, indicá controles rápidos igualmente.
- Si hay incongruencias, enumerá posibles causas y una estrategia para resolverlas.`
}

export async function fetchConciliacionPlotAIRecommendations(input: {
  fechaDesde: string
  fechaHasta: string
  banco?: string
  cuentaBancaria?: string
  estado: 'saldado' | 'incongruencias'
  resumen: {
    totalExtractoEgresos: number
    totalExtractoIngresos: number
    totalPagos: number
    movimientosExtracto: number
    pagosConsiderados: number
  }
  incongruencias: string[]
}): Promise<string> {
  const issues = (input.incongruencias || []).slice(0, MAX_ISSUES)
  const payload = {
    rango: { desde: input.fechaDesde, hasta: input.fechaHasta },
    banco: input.banco ?? null,
    cuenta: input.cuentaBancaria ?? null,
    estado: input.estado,
    resumen: input.resumen,
    incongruencias: issues,
    incongruencias_truncadas: (input.incongruencias || []).length > issues.length
  }

  return generateContent({
    contents: `Reporte de conciliación (JSON):\n${JSON.stringify(payload, null, 2)}`,
    extraContextPrefix: buildPrefix(),
    useCompleteContext: false,
    useMemory: false,
    learnFromResponse: false,
    includeAppManual: false
  })
}

