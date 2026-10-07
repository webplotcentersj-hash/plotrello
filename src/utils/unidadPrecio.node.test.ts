import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatCantidadInput,
  importeLineaVenta,
  parseCantidadInput,
  pasoCantidadUnidad
} from './unidadPrecio.ts'

describe('cantidad venta / unidad', () => {
  it('acepta coma y punto para metros', () => {
    assert.equal(parseCantidadInput('6,25'), 6.25)
    assert.equal(parseCantidadInput('0.95'), 0.95)
    assert.equal(parseCantidadInput('6,'), 6)
    assert.equal(parseCantidadInput(''), null)
    assert.equal(formatCantidadInput(6.25), '6,25')
  })

  it('el paso sigue la unidad: m² en decimales, unidades en enteros', () => {
    assert.equal(pasoCantidadUnidad('m2'), 0.01)
    assert.equal(pasoCantidadUnidad('m²'), 0.01)
    assert.equal(pasoCantidadUnidad('un'), 1)
    assert.equal(pasoCantidadUnidad('hoja'), 1)
  })

  it('el importe es precio por unidad o metro × cantidad', () => {
    assert.equal(importeLineaVenta(32300.02, 6.25), 201875.13)
    assert.equal(importeLineaVenta(19000, 0.95), 18050)
  })
})
