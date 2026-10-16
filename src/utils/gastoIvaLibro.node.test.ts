import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  gastoPuedeIrALibroIva,
  inferirAlicuotaIva,
  netoEIvaDesdeTotal,
  parseComprobanteAfip
} from './gastoIvaLibro.ts'

describe('parseComprobanteAfip', () => {
  it('parte PV y número', () => {
    assert.deepEqual(parseComprobanteAfip('0003-00001234'), { punto_venta: 3, numero: 1234 })
  })
  it('número suelto asume PV 1', () => {
    assert.deepEqual(parseComprobanteAfip('88'), { punto_venta: 1, numero: 88 })
  })
})

describe('inferirAlicuotaIva', () => {
  it('21% típico', () => {
    assert.equal(inferirAlicuotaIva(100, 21), 21)
  })
  it('10.5%', () => {
    assert.equal(inferirAlicuotaIva(100, 10.5), 10.5)
  })
})

describe('netoEIvaDesdeTotal', () => {
  it('completa neto desde total e iva', () => {
    assert.deepEqual(netoEIvaDesdeTotal(121, 21, null), { neto: 100, iva: 21 })
  })
  it('sin iva no va al libro', () => {
    assert.equal(gastoPuedeIrALibroIva(0), false)
    assert.equal(gastoPuedeIrALibroIva(16.72), true)
    assert.equal(gastoPuedeIrALibroIva(-21), true)
  })
})
