import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addDaysIso,
  construirProyeccionVentas,
  montoVentaCobrada,
  normalizeProducto
} from './proyeccionVentas.ts'

describe('addDaysIso', () => {
  it('cruza mes', () => {
    assert.equal(addDaysIso('2026-01-31', 1), '2026-02-01')
  })
})

describe('montoVentaCobrada', () => {
  it('ignora canceladas y pendientes', () => {
    assert.equal(montoVentaCobrada({ estado_pago: 'Cancelado', valor_total: 1000 }), null)
    assert.equal(montoVentaCobrada({ estado_pago: 'Pendiente', valor_total: 1000 }), null)
  })
  it('usa cobrado en parcial', () => {
    assert.equal(montoVentaCobrada({ estado_pago: 'Parcial', valor_total: 1000, monto_pagado: 400 }), 400)
  })
})

describe('construirProyeccionVentas', () => {
  it('proyecta con estacionalidad de día y productos', () => {
    const hoy = '2026-10-16'
    const ventas = []
    for (let i = 0; i < 56; i++) {
      const fecha = addDaysIso(hoy, -(55 - i))
      const [y, m, d] = fecha.split('-').map(Number)
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const total = dow === 5 ? 20000 : 10000
      ventas.push({
        fecha,
        total,
        metodo: 'Efectivo',
        vendedor: 'Ana',
        items: [{ descripcion: 'Vinilo 2x1', cantidad: 2, precio_total: total }]
      })
    }
    const p = construirProyeccionVentas(ventas, hoy)
    assert.ok(p.diasConDatos >= 50)
    assert.equal(p.mejorDia, 'viernes')
    assert.ok(p.prox7 > 0)
    assert.ok(p.mixProductos.some((x) => x.name.includes('Vinilo')))
    assert.ok(p.topProductosPrediccion[0]?.qtySemana > 0)
    assert.match(p.narrativa, /Predicción/)
  })
})

describe('normalizeProducto', () => {
  it('recorta nombres largos', () => {
    const n = normalizeProducto('  Lona   front   impresion   de   gran   formato   con   ojal  ')
    assert.ok(n.length <= 43)
  })
})
