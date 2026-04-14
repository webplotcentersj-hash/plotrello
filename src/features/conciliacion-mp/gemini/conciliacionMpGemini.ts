/**
 * Análisis asistido con Gemini (mismo stack que PlotAI).
 * No aplica matches automáticamente: solo sugerencias auditables.
 */
import { generateContent } from '../../../services/plotAIService'
import type { NormalizedMovement, ReconciliationRules } from '../domain/types'
import { movementToBrief } from '../domain/reconciliation-engine'

export type GeminiMpSuggestedMatch = {
  bank_ids: string[]
  mp_ids: string[]
  confidence_score: number
  explanation: string
  probable_reason: string
  warnings?: string[]
  recommended_action: string
}

export type GeminiMpAnalysisResult = {
  suggested_matches: GeminiMpSuggestedMatch[]
  grouping_suggestions: Array<{
    bank_id: string
    mp_ids: string[]
    confidence_score: number
    explanation: string
  }>
  observations: string[]
  global_warnings: string[]
}

function parseJson(text: string): GeminiMpAnalysisResult {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned) as GeminiMpAnalysisResult
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as GeminiMpAnalysisResult
    }
    throw new Error('Gemini no devolvió JSON válido.')
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        window.clearTimeout(id)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(id)
        reject(e)
      }
    )
  })
}

export async function analyzeUnmatchedWithGemini(input: {
  unmatchedBank: NormalizedMovement[]
  unmatchedMp: NormalizedMovement[]
  rules: ReconciliationRules
  /** Limitar tokens: muestra representativa + totales */
  maxBankSample?: number
  maxMpSample?: number
}): Promise<GeminiMpAnalysisResult> {
  const maxB = input.maxBankSample ?? 40
  const maxM = input.maxMpSample ?? 80

  const bankSample = input.unmatchedBank.slice(0, maxB).map(movementToBrief)
  const mpSample = input.unmatchedMp.slice(0, maxM).map(movementToBrief)

  const payload = {
    resumen: {
      pendientes_banco_total: input.unmatchedBank.length,
      pendientes_mp_total: input.unmatchedMp.length,
      filas_en_muestra_banco: bankSample.length,
      filas_en_muestra_mp: mpSample.length,
      nota_muestra:
        'La muestra es solo una parte; el total pendiente puede ser mucho mayor. Redactá conclusiones en consecuencia.'
    },
    reglas_activas_sistema: input.rules,
    movimientos_banco_sin_par_muestra: bankSample,
    movimientos_mp_sin_par_muestra: mpSample
  }

  const prefix = `Sos un asistente de conciliación contable entre PLANILLA BANCARIA (resumida) y EXTRACTO MERCADO PAGO (detallado).

REGLA DE IDIOMA (OBLIGATORIA):
- Respondé en ESPAÑOL (Argentina), tono claro para contador/usuario.
- Todo texto humano dentro del JSON debe estar en español: explanation, probable_reason, warnings, recommended_action, cada explanation de grouping_suggestions, cada observations y cada global_warnings.
- NO escribas párrafos en inglés. Los únicos términos en inglés permitidos son los NOMBRES DE LAS CLAVES JSON del esquema (suggested_matches, bank_ids, etc.) y los ids técnicos de movimientos.
- Si citás nombres de reglas en inglés (tolAmountAbs, minScoreAccept, etc.), traducí o explicá en español qué significan.

Los datos son una MUESTRA de movimientos sin emparejar; los totales en resumen indican el volumen real.

IMPORTANTE:
- No tomés decisiones definitivas: solo sugerencias auditables.
- Podés proponer coincidencias 1:1, agrupaciones 1:N (un banco explicado por varios MP), y explicar diferencias por comisiones, impuestos o fechas.
- Usá solo los ids de movimiento que vienen en el JSON.

DEVOLVÉ SOLO JSON VÁLIDO (sin markdown, sin texto fuera del objeto) con esta estructura (mantené los nombres de claves exactamente así):
{
  "suggested_matches": [
    {
      "bank_ids": [],
      "mp_ids": [],
      "confidence_score": 0,
      "explanation": "texto en español",
      "probable_reason": "texto en español",
      "warnings": ["texto en español"],
      "recommended_action": "texto en español"
    }
  ],
  "grouping_suggestions": [
    { "bank_id": "", "mp_ids": [], "confidence_score": 0, "explanation": "texto en español" }
  ],
  "observations": ["cada ítem en español"],
  "global_warnings": ["cada ítem en español"]
}

confidence_score de 0 a 100. Sé conservador si faltan datos fuera de la muestra.`

  const text = await withTimeout(
    generateContent({
      contents: `Datos de pendientes para conciliar (JSON). Recordá: todo texto explicativo en español.\n${JSON.stringify(payload)}`,
      extraContextPrefix: prefix,
      useCompleteContext: false,
      useMemory: false,
      learnFromResponse: false,
      includeAppManual: false
    }),
    480_000,
    'Gemini tardó más de 8 minutos en el análisis de pendientes.'
  )

  const parsed = parseJson(text)
  if (!parsed.suggested_matches) parsed.suggested_matches = []
  if (!parsed.grouping_suggestions) parsed.grouping_suggestions = []
  if (!parsed.observations) parsed.observations = []
  if (!parsed.global_warnings) parsed.global_warnings = []
  return parsed
}
