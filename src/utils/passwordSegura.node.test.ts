import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generarPasswordSegura } from './passwordSegura.ts'

describe('generarPasswordSegura', () => {
  it('genera largo ≥12 con mayúscula, minúscula, dígito y símbolo', () => {
    const pass = generarPasswordSegura()
    assert.ok(pass.length >= 12)
    assert.match(pass, /[a-z]/)
    assert.match(pass, /[A-Z]/)
    assert.match(pass, /[0-9]/)
    assert.match(pass, /[!@#$%&*\-_+]/)
  })

  it('no repite la misma cadena en dos llamadas', () => {
    const a = generarPasswordSegura(16)
    const b = generarPasswordSegura(16)
    assert.notEqual(a, b)
  })
})
