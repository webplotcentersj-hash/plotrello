import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deudasAplicables,
  periodoHabilitaArrastreAuto,
  resumenLiquidacionDeuda
} from './liquidacionDeudas.ts'
import type { RrhhLiquidacionDeuda, RrhhLiquidacionPago } from '../types/api.ts'

function deuda(parcial: Partial<RrhhLiquidacionDeuda> & Pick<RrhhLiquidacionDeuda, 'id' | 'tipo'>): RrhhLiquidacionDeuda {
  return {
    id_usuario: 1,
    concepto: null,
    monto: parcial.monto_pendiente ?? 100,
    monto_pendiente: 100,
    periodo_origen: null,
    periodo_destino: null,
    id_periodo_origen: null,
    activa: true,
    registrado_por: null,
    created_at: '',
    updated_at: '',
    ...parcial
  }
}

describe('liquidacion deudas', () => {
  it('suma neto + deudas − pagos', () => {
    const r = resumenLiquidacionDeuda({
      netoMes: 100000,
      deudas: [deuda({ id: 1, tipo: 'especial', monto_pendiente: 20000 })],
      pagos: [{ id: 1, id_periodo: 1, id_usuario: 1, fecha: '2026-11-01', monto: 30000, url_recibo: null, notas: null, registrado_por: null, created_at: '', updated_at: '' } satisfies RrhhLiquidacionPago]
    })
    assert.equal(r.totalALiquidar, 120000)
    assert.equal(r.pagado, 30000)
    assert.equal(r.saldo, 90000)
  })

  it('arrastre solo aplica al período destino', () => {
    const list = [
      deuda({ id: 1, tipo: 'arrastre', periodo_destino: '2026-11', monto_pendiente: 50 }),
      deuda({ id: 2, tipo: 'arrastre', periodo_destino: '2026-10', monto_pendiente: 80 }),
      deuda({ id: 3, tipo: 'mes_anterior', monto_pendiente: 10 })
    ]
    const a = deudasAplicables(list, 1, '2026-11')
    assert.equal(a.length, 2)
    assert.ok(a.every((d) => d.id !== 2))
  })

  it('habilita arrastre automático desde el mes actual', () => {
    assert.equal(periodoHabilitaArrastreAuto('2026-11', '2026-11-02T12:00:00.000Z'), true)
    assert.equal(periodoHabilitaArrastreAuto('2026-12', '2026-11-02T12:00:00.000Z'), true)
    assert.equal(periodoHabilitaArrastreAuto('2026-10', '2026-11-02T12:00:00.000Z'), false)
  })
})
