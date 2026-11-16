import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clampMontoDevolucion,
  cobradoMostradoVenta,
  esDevolucionTotalDinero,
  estadoPagoTrasDevolucion,
  montoCobradoVentaLocal,
  ventaPuedeDevolverDinero
} from './devolucionVentaLogica.ts'

describe('montoCobradoVentaLocal', () => {
  it('pagado usa el total', () => {
    assert.equal(montoCobradoVentaLocal({ valor_total: 100, estado_pago: 'Pagado', monto_pagado: 1 }), 100)
  })
  it('parcial usa monto_pagado', () => {
    assert.equal(montoCobradoVentaLocal({ valor_total: 100, estado_pago: 'Parcial', monto_pagado: 40 }), 40)
  })
  it('cancelado no se puede devolver', () => {
    assert.equal(ventaPuedeDevolverDinero({ valor_total: 100, estado_pago: 'Cancelado', monto_pagado: 100 }), false)
  })
})

describe('clampMontoDevolucion', () => {
  it('no pasa el cobrado', () => {
    assert.equal(clampMontoDevolucion(200, 50), 50)
  })
  it('detecta devolución total', () => {
    assert.equal(esDevolucionTotalDinero(50, 50), true)
    assert.equal(esDevolucionTotalDinero(10, 50), false)
  })
  it('parcial deja estado Parcial', () => {
    assert.equal(
      estadoPagoTrasDevolucion({ cobradoAntes: 50, montoDevuelto: 20, cancelarVenta: false }),
      'Parcial'
    )
  })
})

describe('cobradoMostradoVenta', () => {
  it('venta Pagada sin filas de cobro muestra el total, no $ 0', () => {
    assert.equal(cobradoMostradoVenta({ valor_total: 7377.72, estado_pago: 'Pagado', monto_pagado: 0 }, []), 7377.72)
  })
  it('venta Parcial sin filas usa monto_pagado', () => {
    assert.equal(cobradoMostradoVenta({ valor_total: 100, estado_pago: 'Parcial', monto_pagado: 30 }, []), 30)
  })
  it('venta Pendiente sin filas queda en 0', () => {
    assert.equal(cobradoMostradoVenta({ valor_total: 100, estado_pago: 'Pendiente', monto_pagado: 0 }, []), 0)
  })
  it('con filas de cobro manda el historial', () => {
    assert.equal(
      cobradoMostradoVenta({ valor_total: 100, estado_pago: 'Pagado', monto_pagado: 100 }, [{ monto: 40 }, { monto: '20.5' }]),
      60.5
    )
  })
})
