/** Tipos persistidos / API — conciliación banco vs Mercado Pago */

export type ConciliacionMpSessionStatus = 'draft' | 'ready' | 'error'

export interface ConciliacionMpSession {
  id: string
  created_at: string
  updated_at: string
  created_by_user_id?: number | null
  created_by_user_name?: string | null
  bank_file_name: string
  mp_file_name: string
  bank_sheet_name?: string | null
  mp_sheet_name?: string | null
  rules_snapshot: Record<string, unknown>
  bank_movements: unknown[]
  mp_movements: unknown[]
  heuristic_matches: unknown[]
  metrics: Record<string, unknown>
  status: ConciliacionMpSessionStatus
}

export interface ConciliacionMpAiRun {
  id: string
  session_id: string
  created_at: string
  created_by_user_id?: number | null
  scope: string
  input_payload: Record<string, unknown>
  output_payload: Record<string, unknown>
  provider: string
}
