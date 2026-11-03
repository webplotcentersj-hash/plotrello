import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizarDisenoPdfFactura } from './disenoPdfFactura.ts'

describe('normalizarDisenoPdfFactura', () => {
  it('acepta plotlab y cae a oficial ante cualquier otra cosa', () => {
    assert.equal(normalizarDisenoPdfFactura('plotlab'), 'plotlab')
    assert.equal(normalizarDisenoPdfFactura('oficial'), 'oficial')
    assert.equal(normalizarDisenoPdfFactura(null), 'oficial')
    assert.equal(normalizarDisenoPdfFactura('otro'), 'oficial')
  })
})
