import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  esDomingo,
  esDomingoOFeriado,
  esFeriado,
  feriadosEntre,
  nombreFeriado
} from './feriadosArgentina.ts'

describe('feriados Argentina', () => {
  it('reconoce feriados inamovibles, carnaval, trasladables y puentes 2026', () => {
    assert.equal(nombreFeriado('2026-01-01'), 'Año Nuevo')
    assert.equal(nombreFeriado('2026-02-16'), 'Carnaval')
    assert.equal(nombreFeriado('2026-02-17'), 'Carnaval')
    assert.equal(nombreFeriado('2026-04-03'), 'Viernes Santo')
    assert.equal(nombreFeriado('2026-06-15'), 'Paso a la Inmortalidad del General Güemes')
    assert.equal(nombreFeriado('2026-10-12'), 'Día del Respeto a la Diversidad Cultural')
    assert.equal(nombreFeriado('2026-11-23'), 'Día de la Soberanía Nacional')
    assert.equal(nombreFeriado('2026-11-09'), 'Visita del Papa León XIV')
    assert.equal(nombreFeriado('2026-03-23'), 'Puente turístico')
    assert.equal(nombreFeriado('2026-07-10'), 'Puente turístico')
    assert.equal(nombreFeriado('2026-12-07'), 'Puente turístico')
    assert.equal(nombreFeriado('2026-10-04'), null)
  })

  it('marca domingos y feriados como no exigibles', () => {
    assert.equal(esDomingo('2026-10-04'), true)
    assert.equal(esDomingo('2026-10-05'), false)
    assert.equal(esDomingoOFeriado('2026-10-04'), true)
    assert.equal(esDomingoOFeriado('2026-10-12'), true)
    assert.equal(esFeriado('2026-10-12'), true)
    assert.equal(esDomingoOFeriado('2026-10-05'), false)
  })

  it('lista feriados del período', () => {
    const oct = feriadosEntre('2026-10-01', '2026-10-31')
    assert.equal(oct.length, 1)
    assert.equal(oct[0]?.fecha, '2026-10-12')
  })
})
