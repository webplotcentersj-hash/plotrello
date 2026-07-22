import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FRASES_MOTIVACIONALES,
  fraseMotivacionalDelDia,
  indiceFraseDelDia
} from './fraseMotivacionalDia'

describe('fraseMotivacionalDia', () => {
  it('cambia de frase entre días distintos', () => {
    const a = indiceFraseDelDia('2026-07-22')
    const b = indiceFraseDelDia('2026-07-23')
    assert.notEqual(a, b)
  })

  it('es estable el mismo día', () => {
    assert.equal(indiceFraseDelDia('2026-07-22'), indiceFraseDelDia('2026-07-22'))
  })

  it('devuelve texto y autor', () => {
    const f = fraseMotivacionalDelDia('2026-07-22')
    assert.ok(f.texto.length > 0)
    assert.ok(f.autor.length > 0)
    assert.ok(FRASES_MOTIVACIONALES.includes(f))
  })
})
