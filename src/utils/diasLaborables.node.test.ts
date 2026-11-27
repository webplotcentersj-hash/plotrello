import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diasATrabajar, fmtDias, pesoDia, pesoDiaLaborable } from './diasLaborables'
import { nombreFeriado } from './feriadosArgentina'

test('lunes a viernes = 1 día, sábado = ½ sólo si trabaja sábados, domingo = 0', () => {
  // Semana sin feriados: lun 2026-11-02 … dom 2026-11-08
  assert.equal(pesoDiaLaborable('2026-11-02', false), 1)
  assert.equal(pesoDiaLaborable('2026-11-06', true), 1)
  assert.equal(pesoDiaLaborable('2026-11-07', true), 0.5)
  assert.equal(pesoDiaLaborable('2026-11-07', false), 0)
  assert.equal(pesoDiaLaborable('2026-11-08', true), 0)
  assert.equal(pesoDia('2026-11-07'), 0.5)
  assert.equal(pesoDia('2026-11-04'), 1)
})

test('una semana completa: 5 días (lun–vie) o 5,5 (lun–sáb)', () => {
  const semana = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
  assert.equal(diasATrabajar(semana, false), 5)
  assert.equal(diasATrabajar(semana, true), 5.5)
})

test('los feriados no cuentan', () => {
  const fechas: string[] = []
  for (let d = 1; d <= 31; d++) fechas.push(`2026-12-${String(d).padStart(2, '0')}`)
  const feriado = fechas.find((f) => nombreFeriado(f))
  assert.ok(feriado, 'diciembre tiene al menos un feriado')
  assert.equal(pesoDiaLaborable(feriado!, true), 0)
})

test('formato con coma decimal', () => {
  assert.equal(fmtDias(21), '21')
  assert.equal(fmtDias(23.5), '23,5')
})
