import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ingresosAcumuladosHasta,
  inicioAnio,
  inicioMes,
  lunesDeSemana
} from './ingresosAcumulados.ts'
import type { CajaMovimiento, PlanillaCajaGuardada } from './types.ts'

function mov(p: Partial<CajaMovimiento>): CajaMovimiento {
  return {
    id: Math.random().toString(36).slice(2),
    fecha: '2026-10-16',
    concepto: 'Venta',
    origen_slug: 'cliente',
    destino_slug: 'u-3',
    efectivo: 0,
    otros: 0,
    origen_importacion: 'plotlab_venta',
    tipo_movimiento: 'ingreso',
    ...p
  }
}

function planilla(opts: { fecha: string; ingresos: number }): PlanillaCajaGuardada {
  return {
    id: 'p1',
    archivo_nombre: 'planilla.pdf',
    fecha_desde: opts.fecha,
    fecha_hasta: opts.fecha,
    caja_nombre: 'Caja',
    caja_slug: 'u-3',
    totales: { ingresos_total: opts.ingresos },
    resumen: { cantidad_ventas: 1, cantidad_egresos: 0, cantidad_mec: 0 }
  }
}

describe('lunesDeSemana', () => {
  it('viernes 16/10/2026 arranca el lunes 12', () => {
    assert.equal(lunesDeSemana('2026-10-16'), '2026-10-12')
  })
  it('domingo cae en la semana que arrancó el lunes anterior', () => {
    assert.equal(lunesDeSemana('2026-10-11'), '2026-10-05')
  })
  it('inicio de mes y año', () => {
    assert.equal(inicioMes('2026-10-16'), '2026-10-01')
    assert.equal(inicioAnio('2026-10-16'), '2026-01-01')
  })
})

describe('ingresosAcumuladosHasta', () => {
  it('suma cobros de semana / mes / año hasta el día ancla', () => {
    const movimientos = [
      mov({ fecha: '2025-12-31', efectivo: 1, monto_total: 1 }),
      mov({ fecha: '2026-09-30', efectivo: 10, monto_total: 10 }),
      mov({ fecha: '2026-10-11', efectivo: 999, monto_total: 999 }),
      mov({ fecha: '2026-10-12', efectivo: 100, monto_total: 100 }),
      mov({ fecha: '2026-10-14', efectivo: 50, monto_total: 50 }),
      mov({ fecha: '2026-10-16', efectivo: 25, monto_total: 25 }),
      mov({ fecha: '2026-10-17', efectivo: 77, monto_total: 77 }),
      mov({
        fecha: '2026-10-16',
        concepto: 'Pase de caja',
        tipo_movimiento: 'traspaso',
        subtipo_pase: 'resto_admin',
        efectivo: 5000,
        monto_total: 5000
      })
    ]
    const r = ingresosAcumuladosHasta('2026-10-16', [], movimientos)
    assert.equal(r.desdeSemana, '2026-10-12')
    assert.equal(r.semana, 175)
    assert.equal(r.mes, 175 + 999)
    assert.equal(r.anio, 175 + 999 + 10)
    assert.equal(r.hasta, '2026-10-16')
  })

  it('si un día no tiene movimientos, usa la planilla de ese día', () => {
    const movimientos = [mov({ fecha: '2026-10-16', efectivo: 25, monto_total: 25 })]
    const planillas = [planilla({ fecha: '2026-10-01', ingresos: 40 })]
    const r = ingresosAcumuladosHasta('2026-10-16', planillas, movimientos)
    assert.equal(r.semana, 25)
    assert.equal(r.mes, 65)
    assert.equal(r.anio, 65)
  })
})
