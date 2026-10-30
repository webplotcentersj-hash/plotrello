import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  construirInformeVentasPeriodo,
  rangoInformeVentas
} from './informeVentasPeriodo.ts'
import type { Venta } from '../../types/api'

function venta(partial: Partial<Venta> & Pick<Venta, 'id' | 'numero_venta' | 'fecha_venta'>): Venta {
  return {
    cliente_nombre: 'Cliente',
    valor_total: 1000,
    estado_pago: 'Pagado',
    id_vendedor: 1,
    nombre_vendedor: 'Ana',
    created_at: '',
    updated_at: '',
    metodo_pago: 'Efectivo',
    ...partial
  }
}

describe('rangoInformeVentas', () => {
  it('semana lun–dom anclada al miércoles', () => {
    const r = rangoInformeVentas('semana', '2026-10-28', '2026-10-30')
    assert.equal(r.desde, '2026-10-26')
    assert.equal(r.hasta, '2026-10-30')
    assert.equal(r.prevDesde, '2026-10-19')
    assert.equal(r.prevHasta, '2026-10-25')
  })

  it('mes completo y mes previo', () => {
    const r = rangoInformeVentas('mes', '2026-10-15', '2026-10-30')
    assert.equal(r.desde, '2026-10-01')
    assert.equal(r.hasta, '2026-10-30')
    assert.equal(r.prevDesde, '2026-09-01')
    assert.equal(r.prevHasta, '2026-09-30')
  })
})

describe('construirInformeVentasPeriodo', () => {
  it('suma cobrado, compara prev y agrupa medios', () => {
    const ventas = [
      venta({
        id: 1,
        numero_venta: 'V1',
        fecha_venta: '2026-10-27',
        valor_total: 2000,
        metodo_pago: 'Transferencia',
        nombre_vendedor: 'Ana'
      }),
      venta({
        id: 2,
        numero_venta: 'V2',
        fecha_venta: '2026-10-28',
        valor_total: 1000,
        metodo_pago: 'Efectivo',
        nombre_vendedor: 'Luis'
      }),
      venta({
        id: 3,
        numero_venta: 'V3',
        fecha_venta: '2026-10-20',
        valor_total: 500,
        metodo_pago: 'Efectivo'
      })
    ]
    const rango = rangoInformeVentas('semana', '2026-10-28', '2026-10-30')
    const inf = construirInformeVentasPeriodo(ventas, {
      modo: 'semana',
      ...rango
    })
    assert.equal(inf.kpis.cobrado, 3000)
    assert.equal(inf.kpis.cobradoPrev, 500)
    assert.equal(inf.kpis.ventasCobradas, 2)
    assert.ok((inf.kpis.pctVsPrev ?? 0) > 0)
    assert.equal(inf.porMetodo[0]?.nombre, 'Transferencia')
    assert.equal(inf.porDia.length, 5)
  })
})
