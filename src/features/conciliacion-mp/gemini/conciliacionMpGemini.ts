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
      unmatched_bank_total: input.unmatchedBank.length,
      unmatched_mp_total: input.unmatchedMp.length,
      bank_muestra: bankSample.length,
      mp_muestra: mpSample.length
    },
    reglas_activas: input.rules,
    movimientos_banco_sin_par_muestra: bankSample,
    movimientos_mp_sin_par_muestra: mpSample
  }

  const prefix = `Sos un asistente de conciliación contable entre PLANILLA BANCARIA (resumida) y EXTRACTO MERCADO PAGO (detallado).
Los datos son una MUESTRA de movimientos aún sin emparejar; los totales indican cuántos hay en el archivo completo.

IMPORTANTE:
- No tomes decisiones definitivas: solo sugerencias para que un humano revise.
- Podés proponer matches 1:1, agrupaciones 1:N (un banco explicado por varios MP), y explicar diferencias por fees/impuestos/fechas.
- Usá solo los ids de movimiento que recibís en el JSON.

DEVOLVÉ SOLO JSON VÁLIDO (sin markdown) con esta forma:
{
  "suggested_matches": [
    {
      "bank_ids": string[],
      "mp_ids": string[],
      "confidence_score": number,
      "explanation": string,
      "probable_reason": string,
      "warnings": string[],
      "recommended_action": string
    }
  ],
  "grouping_suggestions": [
    { "bank_id": string, "mp_ids": string[], "confidence_score": number, "explanation": string }
  ],
  "observations": string[],
  "global_warnings": string[]
}

confidence_score de 0 a 100. Sé conservador si faltan datos fuera de la muestra.`

  const text = await withTimeout(
    generateContent({
      contents: `Contexto conciliación MP (JSON):\n${JSON.stringify(payload)}`,
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
