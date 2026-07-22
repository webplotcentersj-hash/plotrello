import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertPuedeGrabarMovimiento,
  assertPuedeOperarCaja,
  esDuenioCaja,
  idTitularCaja
} from './cajaOwnership'

describe('cajaOwnership', () => {
  it('titular por slug u-{id}', () => {
    assert.equal(idTitularCaja('u-30'), 30)
    assert.equal(esDuenioCaja(30, 'u-30'), true)
    assert.equal(esDuenioCaja(57, 'u-30'), false)
  })

  it('titular por id_usuario en registro', () => {
    assert.equal(esDuenioCaja(30, 'legacy', { slug: 'legacy', id_usuario: 30 }), true)
    assert.equal(esDuenioCaja(1, 'legacy', { slug: 'legacy', id_usuario: 30 }), false)
  })

  it('bloquea operar caja ajena', () => {
    assert.throws(
      () => assertPuedeOperarCaja({ id: 57 }, 'u-30'),
      /Solo el titular/
    )
    assert.doesNotThrow(() => assertPuedeOperarCaja({ id: 30 }, 'u-30'))
    assert.doesNotThrow(() => assertPuedeOperarCaja({ id: 1, esAdmin: true }, 'u-30'))
  })

  it('movimiento: egreso solo desde caja propia', () => {
    assert.throws(
      () =>
        assertPuedeGrabarMovimiento(
          { id: 57 },
          { origen_slug: 'u-30', destino_slug: 'admin', tipo_movimiento: 'egreso' }
        ),
      /Solo el titular/
    )
  })

  it('movimiento: ingreso a caja propia desde admin', () => {
    assert.doesNotThrow(() =>
      assertPuedeGrabarMovimiento(
        { id: 30 },
        { origen_slug: 'admin', destino_slug: 'u-30', tipo_movimiento: 'ingreso' }
      )
    )
  })

  it('movimiento: traspaso fondo desde propia a otra', () => {
    assert.doesNotThrow(() =>
      assertPuedeGrabarMovimiento(
        { id: 30 },
        { origen_slug: 'u-30', destino_slug: 'u-57', tipo_movimiento: 'traspaso' }
      )
    )
  })
})
