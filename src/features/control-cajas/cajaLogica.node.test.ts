import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcularCierre } from './cierreCalculations.ts'
import { calcularTotalesCaja, enrichCierreFromTotales } from './movimientoCaja.ts'
import { mismoCajaSlug } from './cajaSlug.ts'
import {
  calcularCierreTurnoMontos,
  conciliarCierreTurno,
  cuadreArqueoConFondo
} from './cierreTurno.ts'
import type { CajaMovimiento } from './types.ts'

const F = '2026-09-23'

function mov(p: Partial<CajaMovimiento>): CajaMovimiento {
  return {
    id: Math.random().toString(36).slice(2),
    fecha: F,
    concepto: 'Venta',
    origen_slug: 'cliente',
    destino_slug: 'u-3',
    efectivo: 0,
    otros: 0,
    origen_importacion: 'manual',
    ...p
  }
}

describe('mismoCajaSlug', () => {
  it('no confunde u-3 con u-31', () => {
    assert.equal(mismoCajaSlug('u-3', 'u-31'), false)
    assert.equal(mismoCajaSlug('u-31', 'u-3'), false)
    assert.equal(mismoCajaSlug('u-3', 'u-3'), true)
    assert.equal(mismoCajaSlug('U-3 ', 'u-3'), true)
  })
  it('mantiene match flexible por nombre', () => {
    assert.equal(mismoCajaSlug('admin', 'Administración'), true)
  })
})

describe('cierre de turno', () => {
  it('resto a admin = contado − fondo (egresos ya fuera del cajón)', () => {
    const c = calcularCierreTurnoMontos({
      arqueo_efectivo: 500_000,
      arqueo_otros: 0,
      fondo_monto: 100_000,
      egresos_aprobados_ef: 30_000,
      egresos_aprobados_ot: 0
    })
    assert.equal(c.resto_efectivo, 400_000)
    assert.equal(c.total_sale_origen, 500_000)
    const concil = conciliarCierreTurno({ calc: c, arqueoTotal: 500_000 })
    assert.deepEqual(concil.alertas, [])
  })
})

describe('cuadre del arqueo', () => {
  it('contado 0 con objetivo > 0 es faltante', () => {
    const r = cuadreArqueoConFondo({ contado: 0, objetivo: 500_000 })
    assert.equal(r.esFaltante, true)
    assert.equal(r.montoFaltante, 500_000)
    assert.equal(r.cuadra, false)
  })
  it('sin objetivo no hay cuadre', () => {
    assert.equal(cuadreArqueoConFondo({ contado: 0, objetivo: null }).delta, null)
  })
})

describe('totales de caja', () => {
  const movs: CajaMovimiento[] = [
    mov({ tipo_movimiento: 'ingreso', efectivo: 300_000, monto_total: 300_000 }),
    mov({
      tipo_movimiento: 'egreso',
      origen_slug: 'u-3',
      destino_slug: 'admin',
      efectivo: 20_000,
      concepto: 'Semitas'
    }),
    // Pases del cierre de turno: posteriores al arqueo, no mueven el teórico.
    mov({
      concepto: 'Pase de caja',
      tipo_movimiento: 'traspaso',
      subtipo_pase: 'resto_admin',
      id_lote: 'L1',
      origen_slug: 'u-3',
      destino_slug: 'admin',
      efectivo: 280_000
    }),
    // Fondo recibido de otra caja por cierre de turno: no es venta.
    mov({
      concepto: 'Pase de caja',
      subtipo_pase: 'fondo',
      id_lote: 'L0',
      origen_slug: 'u-31',
      destino_slug: 'u-3',
      efectivo: 100_000
    }),
    // Traspaso manual durante el día (2 filas).
    mov({
      tipo_movimiento: 'egreso',
      traspaso_id: 'T1',
      categoria: 'movimiento_entre_cajas',
      origen_slug: 'u-3',
      destino_slug: 'u-31',
      efectivo: 5_000,
      monto_total: 5_000
    }),
    mov({
      tipo_movimiento: 'ingreso',
      traspaso_id: 'T1',
      categoria: 'movimiento_entre_cajas',
      origen_slug: 'u-3',
      destino_slug: 'u-31',
      efectivo: 5_000,
      monto_total: 5_000
    })
  ]

  it('separa ventas/egresos de traspasos y pases', () => {
    const t = calcularTotalesCaja(movs, 'u-3', F, F)
    assert.equal(t.ingresos.efectivo, 300_000)
    assert.equal(t.egresos.efectivo, 20_000)
    assert.equal(t.traspasos_salida.efectivo, 5_000)
    assert.equal(t.traspasos_entrada.efectivo, 0)
    assert.equal(t.detalle.pases_cierre_turno, 2)

    const t31 = calcularTotalesCaja(movs, 'u-31', F, F)
    assert.equal(t31.traspasos_entrada.efectivo, 5_000)
    assert.equal(t31.ingresos.efectivo, 0)
  })

  it('cierre de caja: teórico físico sin sobrante falso', () => {
    const t = calcularTotalesCaja(movs, 'u-3', F, F)
    const c = enrichCierreFromTotales(
      {
        fondo_fijo: 0,
        ing_ef: 0,
        egr_ef: 0,
        ef_contado: 275_000,
        tarj_sist: 0,
        tarj_fis: 0,
        mp_qr: 0,
        trans: 0,
        cta_cte: 0
      },
      t,
      0
    )
    assert.equal(c.ef_teorico, 275_000)
    assert.equal(c.dif_ef, 0)
    assert.equal(c.total_ventas, 300_000)
    assert.equal(c.estado, 'OK')
  })

  it('calcularCierre sin traspasos sigue igual', () => {
    const c = calcularCierre({
      fondo_fijo: 100,
      ing_ef: 50,
      egr_ef: 20,
      ef_contado: 130,
      tarj_sist: 0,
      tarj_fis: 0,
      mp_qr: 0,
      trans: 0,
      cta_cte: 0
    })
    assert.equal(c.ef_teorico, 130)
    assert.equal(c.dif_ef, 0)
  })
})
