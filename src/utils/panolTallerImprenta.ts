/** Pañol Taller de Imprenta: letras A–Z × 3 filas (1 arriba, 2 medio, 3 abajo). */

export const PANOL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as string[]
export const PANOL_ROWS = [1, 2, 3] as const

export type PanolRow = (typeof PANOL_ROWS)[number]
export type PanolSlot = `${string}${PanolRow}` // e.g. A1, M3

export function isValidPanolSlot(value: string | null | undefined): value is PanolSlot {
  if (!value) return false
  const m = /^([A-Z])([123])$/.exec(value.trim().toUpperCase())
  return Boolean(m)
}

export function normalizePanolSlot(value: string | null | undefined): PanolSlot | null {
  if (!value) return null
  const raw = value.trim().toUpperCase().replace(/[\s\-_/]/g, '')
  if (!isValidPanolSlot(raw)) return null
  return raw as PanolSlot
}

export function panolSlotLabel(slot: string): string {
  const n = normalizePanolSlot(slot)
  if (!n) return slot
  const row = Number(n.slice(1)) as PanolRow
  const rowLabel = row === 1 ? 'arriba' : row === 2 ? 'medio' : 'abajo'
  return `${n[0]} · fila ${row} (${rowLabel})`
}

export function parsePanolSlot(slot: string | null | undefined): { letter: string; row: PanolRow } | null {
  const n = normalizePanolSlot(slot)
  if (!n) return null
  return { letter: n[0], row: Number(n.slice(1)) as PanolRow }
}

export function makePanolSlot(letter: string, row: PanolRow): PanolSlot {
  return `${letter.toUpperCase()}${row}` as PanolSlot
}

export const ALL_PANOL_SLOTS: PanolSlot[] = PANOL_LETTERS.flatMap((letter) =>
  PANOL_ROWS.map((row) => makePanolSlot(letter, row))
)
