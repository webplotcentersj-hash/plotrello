export type {
  HeuristicMatch,
  HeuristicMatchType,
  MovementSource,
  NormalizedMovement,
  ReconciliationMetrics,
  ReconciliationRules
} from './domain/types'
export { defaultReconciliationRules } from './domain/types'
export {
  runReconciliation,
  summarizeUnmatched,
  movementToBrief,
  computeMetrics,
  suggestMpCandidatesForBank
} from './domain/reconciliation-engine'
export type { MpCandidateScore } from './domain/reconciliation-engine'
export { downloadCsv, buildMatchesCsvRows, buildMovementsCsvRows } from './export/csvExport'
export { normalizeBankRows, normalizeMercadoPagoRows } from './parsers/normalizeMovements'
export { readSheetRows, listWorkbookSheetNames } from './parsers/spreadsheetCore'
export { analyzeUnmatchedWithGemini } from './gemini/conciliacionMpGemini'
export type { GeminiMpAnalysisResult, GeminiMpSuggestedMatch } from './gemini/conciliacionMpGemini'
