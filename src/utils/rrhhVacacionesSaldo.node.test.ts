import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aniosAntiguedadAlCorte,
  calcularCupoVacacionesLct,
  cupoLctPorAnios,
  diasPrestacionEnAnio
} from './rrhhVacacionesSaldo'

describe('cupoLctPorAnios (art. 150)', () => {
  it('tramos inclusivos hasta 5 / 10 / 20', () => {
    assert.equal(cupoLctPorAnios(0), 14)
    assert.equal(cupoLctPorAnios(5), 14)
    assert.equal(cupoLctPorAnios(6), 21)
    assert.equal(cupoLctPorAnios(10), 21)
    assert.equal(cupoLctPorAnios(11), 28)
    assert.equal(cupoLctPorAnios(20), 28)
    assert.equal(cupoLctPorAnios(21), 35)
  })
})

describe('calcularCupoVacacionesLct', () => {
  it('año completo con antigüedad 5 → 14 (no 21)', () => {
    const r = calcularCupoVacacionesLct('2020-12-31', 2025)
    assert.equal(aniosAntiguedadAlCorte('2020-12-31', 2025), 5)
    assert.equal(r.baseLegal, 'art150')
    assert.equal(r.corresponden, 14)
  })

  it('año completo con antigüedad 10 → 21', () => {
    const r = calcularCupoVacacionesLct('2015-12-31', 2025)
    assert.equal(r.anios, 10)
    assert.equal(r.corresponden, 21)
  })

  it('ingreso tardío en el año → proporcional art. 151', () => {
    const r = calcularCupoVacacionesLct('2025-09-01', 2025)
    const dias = diasPrestacionEnAnio('2025-09-01', 2025)
    assert.ok(dias < 182)
    assert.equal(r.baseLegal, 'art151')
    assert.equal(r.corresponden, Math.floor(dias / 20))
  })

  it('sin fecha de ingreso → 0', () => {
    const r = calcularCupoVacacionesLct(null, 2025)
    assert.equal(r.corresponden, 0)
    assert.equal(r.baseLegal, 'sin_ingreso')
  })
})
