import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cobroDesdeVenta,
  cobroOpToTaskFields,
  formatMontoPagoParcial,
  parseMontoPagoParcial
} from './opCobroEstado.ts'

describe('parseMontoPagoParcial', () => {
  it('no multiplica por 100 un decimal con punto', () => {
    assert.equal(parseMontoPagoParcial('19645.00'), 19645)
    assert.equal(parseMontoPagoParcial('24054.94'), 24055)
    assert.equal(parseMontoPagoParcial('19645.5'), 19646)
  })

  it('entiende formato AR con miles y decimal', () => {
    assert.equal(parseMontoPagoParcial('19.645,50'), 19646)
    assert.equal(parseMontoPagoParcial('1.964.500'), 1964500)
    assert.equal(parseMontoPagoParcial('19645,00'), 19645)
  })

  it('formatea sin inventar ceros', () => {
    assert.equal(formatMontoPagoParcial(19645), '19.645')
    assert.equal(formatMontoPagoParcial(24054), '24.054')
  })
})

describe('cobroDesdeVenta parcial', () => {
  it('pasa montos enteros que parsean bien', () => {
    const c = cobroDesdeVenta({
      estado_pago: 'Parcial',
      valor_total: 43699.94,
      monto_pagado: 19645
    })
    assert.equal(c.estado, 'parcial')
    assert.equal(c.monto, '19645')
    assert.equal(c.saldo, '24055')
    const fields = cobroOpToTaskFields(c.estado, c.monto, c.saldo)
    assert.equal(fields.montoPagoParcial, 19645)
    assert.equal(fields.montoSaldoPendiente, 24055)
  })
})
