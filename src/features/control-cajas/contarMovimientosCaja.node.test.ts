import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { contarMovimientosCaja } from './cajaMenuOperativaData.ts'
import type { CajaMovimiento } from './types.ts'

function mov(partial: Partial<CajaMovimiento> & Pick<CajaMovimiento, 'id' | 'fecha' | 'tipo_movimiento'>): CajaMovimiento {
  return {
    concepto: 'Otro',
    origen_slug: 'admin',
    destino_slug: 'u-1',
    efectivo: 0,
    otros: 0,
    origen_importacion: 'manual',
    monto_total: 100,
    ...partial
  }
}

describe('contarMovimientosCaja', () => {
  const movimientos: CajaMovimiento[] = [
    mov({ id: '1', fecha: '2026-10-26', tipo_movimiento: 'ingreso', monto_total: 1000, efectivo: 1000 }),
    mov({ id: '2', fecha: '2026-10-26', tipo_movimiento: 'egreso', origen_slug: 'u-1', destino_slug: 'admin', monto_total: 200, efectivo: 200 }),
    mov({ id: '3', fecha: '2026-10-26', tipo_movimiento: 'traspaso', origen_slug: 'u-1', destino_slug: 'admin', monto_total: 50 }),
    mov({ id: '4', fecha: '2026-10-25', tipo_movimiento: 'ingreso', monto_total: 300, efectivo: 300 }),
    mov({ id: '5', fecha: '2026-10-26', tipo_movimiento: 'ingreso', anulado: true, monto_total: 999 }),
    mov({ id: '6', fecha: '2026-10-26', tipo_movimiento: 'ingreso', destino_slug: 'u-2', monto_total: 10 })
  ]

  it('cuenta todos los movimientos del día de esa caja', () => {
    const hoy = contarMovimientosCaja(movimientos, 'u-1', '2026-10-26')
    assert.equal(hoy.total, 3)
    assert.equal(hoy.ingresos, 1)
    assert.equal(hoy.ingresosMonto, 1000)
    assert.equal(hoy.egresos, 1)
    assert.equal(hoy.egresosMonto, 200)
    assert.equal(hoy.traspasos, 1)
  })

  it('sin fecha incluye el histórico y deja afuera anulados y otra caja', () => {
    const todo = contarMovimientosCaja(movimientos, 'u-1', null)
    assert.equal(todo.total, 4)
    assert.equal(todo.ingresos, 2)
    assert.equal(todo.ingresosMonto, 1300)
  })
})
