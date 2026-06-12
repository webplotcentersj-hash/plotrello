import type { WorkPoolOrdenSugerida } from '../../types/workPool'

export const WORK_POOL_OP_SEARCH_SELECT =
  'id, numero_op, cliente, descripcion, estado, sector, dni_cuit, telefono_cliente, email_cliente, numero_ficha_original, fecha_creacion'

export type WorkPoolOpSearchRow = WorkPoolOrdenSugerida & {
  dni_cuit?: string | null
  telefono_cliente?: string | null
  email_cliente?: string | null
  numero_ficha_original?: string | null
  fecha_creacion?: string | null
}

export type ParsedWorkPoolOpQuery = {
  canSearch: boolean
  raw: string
  idBd?: number
  /** Solo dígitos extraídos para matchear nº OP (100660, OP-100660, etc.). */
  opDigits?: string
  opRaw: string
  tokens: string[]
  textBlob: string
  isOpNumeric: boolean
}

export function parseWorkPoolOpQuery(raw: string): ParsedWorkPoolOpQuery {
  const trimmed = raw.trim()
  const empty: ParsedWorkPoolOpQuery = {
    canSearch: false,
    raw: trimmed,
    opRaw: '',
    tokens: [],
    textBlob: '',
    isOpNumeric: false
  }
  if (!trimmed) return empty

  const hashMatch = trimmed.match(/^#?(\d+)$/)
  if (hashMatch) {
    const id = Number(hashMatch[1])
    if (Number.isFinite(id) && id > 0) {
      return {
        canSearch: true,
        raw: trimmed,
        idBd: id,
        opRaw: trimmed,
        tokens: [],
        textBlob: trimmed.toLowerCase(),
        isOpNumeric: true
      }
    }
  }

  const opRaw = trimmed.replace(/^OP[\s#-]*/i, '').trim()
  const compactOp = opRaw.replace(/\s/g, '')
  const digitsOnly = compactOp.replace(/\D/g, '')
  const isPureNumericOp = /^\d+$/.test(compactOp) && digitsOnly.length >= 2

  const tokens = trimmed
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((t) => t.replace(/^op[\s#-]*/i, '').trim())
    .filter((t) => t.length >= 2)

  const canSearch =
    trimmed.length >= 2 || digitsOnly.length >= 3 || (isPureNumericOp && digitsOnly.length >= 2)

  return {
    canSearch,
    raw: trimmed,
    opDigits: digitsOnly.length >= 2 ? digitsOnly : undefined,
    opRaw,
    tokens,
    textBlob: trimmed.toLowerCase(),
    isOpNumeric: isPureNumericOp || (digitsOnly.length >= 3 && tokens.length === 0)
  }
}

function normOpDigits(numeroOp: string): string {
  return numeroOp.replace(/\D/g, '')
}

function normOpText(numeroOp: string): string {
  return numeroOp.replace(/\s/g, '').replace(/^OP[\s#-]*/i, '').toLowerCase()
}

export function rankWorkPoolOpRow(row: WorkPoolOpSearchRow, parsed: ParsedWorkPoolOpQuery): number {
  let score = 0
  const opText = normOpText(row.numero_op ?? '')
  const opDigits = normOpDigits(row.numero_op ?? '')
  const cliente = (row.cliente ?? '').toLowerCase()
  const desc = (row.descripcion ?? '').toLowerCase()
  const dni = (row.dni_cuit ?? '').toLowerCase()
  const ficha = (row.numero_ficha_original ?? '').toLowerCase()
  const tel = (row.telefono_cliente ?? '').replace(/\D/g, '')
  const qTel = parsed.raw.replace(/\D/g, '')

  if (parsed.idBd != null && row.id === parsed.idBd) score += 10_000

  if (parsed.opDigits) {
    const qd = parsed.opDigits
    if (opDigits === qd) score += 5_000
    else if (opDigits.endsWith(qd)) score += 3_800
    else if (opDigits.startsWith(qd)) score += 3_200
    else if (opDigits.includes(qd)) score += 2_500
    if (opText === parsed.opRaw.toLowerCase().replace(/\s/g, '')) score += 4_500
    else if (opText.includes(parsed.opRaw.toLowerCase().replace(/\s/g, ''))) score += 2_000
  }

  if (parsed.textBlob.length >= 2) {
    if (cliente === parsed.textBlob) score += 2_200
    else if (cliente.includes(parsed.textBlob)) score += 1_400
    if (desc.includes(parsed.textBlob)) score += 700
    if (dni.includes(parsed.textBlob.replace(/\s/g, ''))) score += 1_600
    if (ficha.includes(parsed.textBlob)) score += 1_200
  }

  let tokenHits = 0
  for (const token of parsed.tokens) {
    const t = token.toLowerCase()
    if (cliente.includes(t)) {
      score += 900
      tokenHits += 1
    }
    if (desc.includes(t)) {
      score += 450
      tokenHits += 1
    }
    if (opText.includes(t) || opDigits.includes(t.replace(/\D/g, ''))) {
      score += 650
      tokenHits += 1
    }
    if (dni.includes(t.replace(/\s/g, ''))) score += 800
  }
  if (parsed.tokens.length > 1 && tokenHits >= parsed.tokens.length) score += 1_500

  if (qTel.length >= 4 && tel.includes(qTel)) score += 1_100

  if (row.fecha_creacion) {
    score += new Date(row.fecha_creacion).getTime() / 1e15
  }

  return score
}

export function mergeAndRankWorkPoolOpRows(
  batches: WorkPoolOpSearchRow[][],
  parsed: ParsedWorkPoolOpQuery,
  limit: number
): WorkPoolOrdenSugerida[] {
  const byId = new Map<number, WorkPoolOpSearchRow>()
  for (const batch of batches) {
    for (const row of batch) {
      if (!row?.id) continue
      const prev = byId.get(row.id)
      if (!prev || rankWorkPoolOpRow(row, parsed) > rankWorkPoolOpRow(prev, parsed)) {
        byId.set(row.id, row)
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => rankWorkPoolOpRow(b, parsed) - rankWorkPoolOpRow(a, parsed))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      numero_op: row.numero_op,
      cliente: row.cliente,
      descripcion: row.descripcion,
      estado: row.estado,
      sector: row.sector
    }))
}

export function mapOrdenRow(row: Record<string, unknown>): WorkPoolOpSearchRow {
  return {
    id: Number(row.id),
    numero_op: String(row.numero_op ?? ''),
    cliente: String(row.cliente ?? ''),
    descripcion: (row.descripcion as string) ?? null,
    estado: String(row.estado ?? ''),
    sector: (row.sector as string) ?? null,
    dni_cuit: (row.dni_cuit as string) ?? null,
    telefono_cliente: (row.telefono_cliente as string) ?? null,
    email_cliente: (row.email_cliente as string) ?? null,
    numero_ficha_original: (row.numero_ficha_original as string) ?? null,
    fecha_creacion: (row.fecha_creacion as string) ?? null
  }
}
