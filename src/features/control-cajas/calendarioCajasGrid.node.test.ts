import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildMonthGrid,
  clampFechaToYearMonth,
  shiftYearMonth
} from './calendarioCajasGrid.ts'

describe('clampFechaToYearMonth', () => {
  it('pasa el 16 de octubre a septiembre 16', () => {
    assert.equal(clampFechaToYearMonth('2026-10-16', '2026-09'), '2026-09-16')
  })
  it('31 de marzo cae en 28 de febrero', () => {
    assert.equal(clampFechaToYearMonth('2026-03-31', '2026-02'), '2026-02-28')
  })
})

describe('buildMonthGrid', () => {
  it('octubre 2026 siempre ocupa 6 semanas', () => {
    const cells = buildMonthGrid(2026, 10)
    assert.equal(cells.length, 42)
    assert.equal(cells.filter(Boolean)[0], '2026-10-01')
    assert.equal(cells.filter(Boolean).at(-1), '2026-10-31')
  })
})

describe('shiftYearMonth', () => {
  it('de octubre a septiembre y a noviembre', () => {
    assert.equal(shiftYearMonth('2026-10', -1), '2026-09')
    assert.equal(shiftYearMonth('2026-10', 1), '2026-11')
  })
})
