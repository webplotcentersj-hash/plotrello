import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCajaRegistroUsuario,
  cajaNombreForUsuario,
  cajaSlugForUsuario,
  esCajaSlugUsuario
} from './cajaPorUsuario.ts'

describe('cajaPorUsuario', () => {
  it('genera slug estable u-{id}', () => {
    assert.equal(cajaSlugForUsuario(42), 'u-42')
    assert.equal(esCajaSlugUsuario('u-42'), true)
    assert.equal(esCajaSlugUsuario('noelia'), false)
  })

  it('nombre de caja desde usuario', () => {
    assert.equal(cajaNombreForUsuario('Juan Pérez'), 'Caja Juan Pérez')
    assert.equal(cajaNombreForUsuario('Caja Rosa'), 'Caja Rosa')
    assert.equal(buildCajaRegistroUsuario(5, 'Ana').slug, 'u-5')
    assert.equal(buildCajaRegistroUsuario(5, 'Ana').activa, true)
  })
})
