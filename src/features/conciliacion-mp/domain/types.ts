export type MovementSource = 'bank' | 'mercado_pago'

export type HeuristicMatchType =
  | 'exact'
  | 'approximate_date'
  | 'text_amount'
  | 'tolerance_amount'
  | 'reference'
  | 'grouped_bank_to_mp'
  | 'partial'
  | 'none'

export interface ReconciliationRules {
  tolAmountAbs: number
  tolAmountPct: number
  dateWindowDays: number
  minScoreAccept: number
  maxGroupSize: number
  excludeSaldoRows: boolean
  weightAmount: number
  weightDate: number
  weightText: number
  weightRef: number
}

export const defaultReconciliationRules: ReconciliationRules = {
  tolAmountAbs: 0.02,
  tolAmountPct: 0.0005,
  dateWindowDays: 3,
  minScoreAccept: 55,
  maxGroupSize: 5,
  excludeSaldoRows: true,
  weightAmount: 0.45,
  weightDate: 0.25,
  weightText: 0.2,
  weightRef: 0.1
}

export interface NormalizedMovement {
  id: string
  source: MovementSource
  fecha: string
  fechaHora?: string
  descripcion: string
  tipo: string
  subtipo?: string
  tercero?: string
  referencia?: string
  importeNeto: number
  credito?: number
  debito?: number
  moneda: string
  classification: string
  hojaOriginal: string
  filaOriginal: number
  raw: Record<string, unknown>
}

export interface HeuristicMatch {
  bankIds: string[]
  mpIds: string[]
  matchType: HeuristicMatchType
  score: number
  phase: number
  reason: string
  diffAmount: number
}

export interface ReconciliationMetrics {
  totalBank: number
  totalMp: number
  matchedBankCount: number
  matchedMpCount: number
  pctBankReconciled: number
  pctMpReconciled: number
  sumBankAbs: number
  sumMpAbs: number
  groupedMatches: number
}
