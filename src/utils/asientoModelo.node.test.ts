import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lineasDesdeModelo } from './asientoModelo'

test('modelo: reparte por porcentaje y balancea al centavo', () => {
  const l = lineasDesdeModelo(
    [
      { id_cuenta: 1, lado: 'Debe', porcentaje: 33.333 },
      { id_cuenta: 2, lado: 'Debe', porcentaje: 66.667 },
      { id_cuenta: 3, lado: 'Haber', porcentaje: 100 }
    ],
    100.01
  )
  const debe = Math.round(l.reduce((s, x) => s + x.debe, 0) * 100)
  const haber = Math.round(l.reduce((s, x) => s + x.haber, 0) * 100)
  assert.equal(debe, haber)
  assert.equal(haber, 10001)
  assert.equal(l[2].debe, 0)
})
