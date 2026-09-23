import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { baseComisionable, comisionDeVenta, montoComisionable } from './calculoComisiones.ts'

describe('monto comisionable según el momento', () => {
  it('al cobrar: venta pagada comisiona el total; parcial, lo cobrado', () => {
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pagado' }, 'cobro'), 121000)
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Parcial', monto_pagado: 50000 }, 'cobro'), 50000)
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pendiente' }, 'cobro'), 0)
  })

  it('al registrar la venta: comisiona el total aunque no esté cobrada', () => {
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pendiente' }, 'venta'), 121000)
  })

  it('al facturar: solo con factura autorizada', () => {
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pendiente', facturada: true }, 'factura'), 121000)
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pagado', facturada: false }, 'factura'), 0)
  })

  it('una venta cancelada no comisiona', () => {
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Cancelado', monto_pagado: 121000 }, 'cobro'), 0)
  })

  it('las notas de crédito bajan el monto, nunca por debajo de cero', () => {
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pagado', notas_credito: 21000 }, 'cobro'), 100000)
    assert.equal(montoComisionable({ valor_total: 121000, estado_pago: 'Pagado', notas_credito: 200000 }, 'cobro'), 0)
  })
})

describe('base y comisión', () => {
  it('el neto saca el IVA', () => {
    assert.equal(baseComisionable(121000, 'neto', 21), 100000)
    assert.equal(baseComisionable(121000, 'total', 21), 121000)
  })

  it('comisión sobre el neto de una venta cobrada', () => {
    const r = comisionDeVenta(
      { valor_total: 121000, estado_pago: 'Pagado' },
      { base: 'neto', momento: 'cobro', alicuotaIva: 21, porcentaje: 3 }
    )
    assert.deepEqual(r, { comisionable: 121000, base_monto: 100000, comision: 3000 })
  })

  it('cobro parcial comisiona en proporción', () => {
    const r = comisionDeVenta(
      { valor_total: 121000, estado_pago: 'Parcial', monto_pagado: 60500 },
      { base: 'neto', momento: 'cobro', alicuotaIva: 21, porcentaje: 3 }
    )
    assert.equal(r.base_monto, 50000)
    assert.equal(r.comision, 1500)
  })

  it('sin porcentaje configurado no hay comisión', () => {
    const r = comisionDeVenta(
      { valor_total: 121000, estado_pago: 'Pagado' },
      { base: 'neto', momento: 'cobro', alicuotaIva: 21, porcentaje: 0 }
    )
    assert.equal(r.comision, 0)
  })
})
