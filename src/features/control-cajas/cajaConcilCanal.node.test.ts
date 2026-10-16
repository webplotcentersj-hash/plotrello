import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cruzarPorMonto,
  esCobroExtractoMp,
  esIngresoExtractoBanco,
  sistemaBancoParaFecha,
  sistemaMpParaFecha
} from './cajaConcilCanal.ts'
import type { CajaCierre, CajaMovimiento } from './types.ts'

function mov(partial: Partial<CajaMovimiento> & Pick<CajaMovimiento, 'id' | 'concepto'>): CajaMovimiento {
  return {
    fecha: '2026-10-16',
    origen_slug: 'u-1',
    destino_slug: 'u-1',
    efectivo: 0,
    otros: 0,
    origen_importacion: 'plotlab_venta',
    tipo_movimiento: 'ingreso',
    ...partial
  }
}

describe('esCobroExtractoMp', () => {
  it('toma cobros positivos y descarta fees', () => {
    assert.equal(esCobroExtractoMp('cobro', 1500), true)
    assert.equal(esCobroExtractoMp('costo', 1500), false)
    assert.equal(esCobroExtractoMp('cobro', -1500), false)
  })
})

describe('esIngresoExtractoBanco', () => {
  it('solo acreditaciones', () => {
    assert.equal(esIngresoExtractoBanco(200), true)
    assert.equal(esIngresoExtractoBanco(-200), false)
  })
})

describe('cruzarPorMonto', () => {
  it('empareja por monto y deja huérfanos', () => {
    const cruce = cruzarPorMonto(
      [
        { id: 's1', monto: 1000 },
        { id: 's2', monto: 2500 }
      ],
      [
        { id: 'e1', monto: 1000.2 },
        { id: 'e2', monto: 800 }
      ],
      0.51
    )
    const ok = cruce.find((l) => l.estado === 'ok')
    assert.equal(ok?.sistemaId, 's1')
    assert.equal(ok?.extractoId, 'e1')
    assert.equal(cruce.some((l) => l.estado === 'solo_sistema' && l.sistemaId === 's2'), true)
    assert.equal(cruce.some((l) => l.estado === 'solo_extracto' && l.extractoId === 'e2'), true)
  })
})

describe('sistemaMpParaFecha', () => {
  it('no mezcla tarjeta POS con Mercado Pago', () => {
    const movimientos = [
      mov({
        id: 'pos',
        concepto: 'Venta POS',
        tarjeta: 5000,
        observacion: 'PL-VENTA-1'
      }),
      mov({
        id: 'mp',
        concepto: 'Venta MP',
        tarjeta: 3200,
        observacion: 'Mercado Pago PL-VENTA-2'
      })
    ]
    const r = sistemaMpParaFecha('2026-10-16', [], [], movimientos)
    assert.equal(r.valor, 3200)
    assert.equal(r.fuente, 'plotlab')
  })

  it('ignora tarj_sist de cierres si hay cobros MP', () => {
    const cierres = [
      {
        fecha: '2026-10-16',
        tarj_sist: 9000,
        mp_qr: 0,
        trans: 0
      } as CajaCierre
    ]
    const movimientos = [
      mov({
        id: 'mp',
        concepto: 'Venta MP',
        tarjeta: 1100,
        medios: { mercado_pago: 1100 }
      })
    ]
    const r = sistemaMpParaFecha('2026-10-16', cierres, [], movimientos)
    assert.equal(r.valor, 1100)
  })
})

describe('sistemaBancoParaFecha', () => {
  it('prioriza transferencias de movimientos sobre el cierre', () => {
    const cierres = [{ fecha: '2026-10-16', tarj_sist: 0, mp_qr: 0, trans: 9999 } as CajaCierre]
    const movimientos = [
      mov({
        id: 'tr',
        concepto: 'Transferencia',
        transferencia_bancaria: 4500
      })
    ]
    const r = sistemaBancoParaFecha('2026-10-16', cierres, [], movimientos)
    assert.equal(r.valor, 4500)
  })
})
