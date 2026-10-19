import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addDaysIso,
  construirProyeccionVentas,
  dowIso,
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
  it('proyecta con estacionalidad de día y productos con un mes', () => {
    const hoy = '2026-10-16'
    const ventas = []
    for (let i = 0; i < 30; i++) {
      const fecha = addDaysIso(hoy, -(29 - i))
      const dow = dowIso(fecha)
      if (dow === 0) continue
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
    assert.ok(p.diasConDatos >= 20)
    assert.equal(p.mejorDia, 'viernes')
    assert.notEqual(p.peorDia, 'domingo')
    assert.ok(p.prox7 > 0)
    assert.ok(p.mixProductos.some((x) => x.name.includes('Vinilo')))
    assert.ok(p.topProductosPrediccion[0]?.qtySemana > 0)
    assert.match(p.narrativa, /Predicción/)
  })

  it('no diluye el promedio con domingos y predice domingo en 0', () => {
    const hoy = '2026-10-16'
    const ventas = []
    for (let i = 0; i < 30; i++) {
      const fecha = addDaysIso(hoy, -(29 - i))
      const total = dowIso(fecha) === 0 ? 80000 : 6000
      ventas.push({ fecha, total, metodo: 'Efectivo', vendedor: 'Ana' })
    }
    const p = construirProyeccionVentas(ventas, hoy)
    assert.ok(Math.abs(p.promedioDiario - 6000) < 1)
    assert.notEqual(p.peorDia, 'domingo')
    const domingosFuturos = p.serie.filter((s) => s.real == null && dowIso(s.fecha) === 0)
    assert.ok(domingosFuturos.length >= 1)
    for (const d of domingosFuturos) {
      assert.equal(d.proyectado, 0)
    }
  })
})

describe('normalizeProducto', () => {
  it('recorta nombres largos', () => {
    const n = normalizeProducto('  Lona   front   impresion   de   gran   formato   con   ojal  ')
    assert.ok(n.length <= 43)
  })
})
