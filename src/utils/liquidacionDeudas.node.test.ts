import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { RrhhLiquidacionDeuda, RrhhLiquidacionPago } from '../types/api.ts'
import {
  excedenteSinAplicar,
  normalizarAplicaciones,
  repartirFifo,
  resumenLiquidacionDeuda,
  saldoParaArrastre,
  totalAplicadoADeudas
} from './liquidacionDeudas.ts'
import { conceptosMiLiquidacionDigital, valorDiaPeriodo } from './rrhhLiquidacion.ts'

function deuda(id: number, pendiente: number): RrhhLiquidacionDeuda {
  return {
    id,
    id_usuario: 1,
    tipo: 'especial',
    concepto: null,
    monto: pendiente,
    monto_pendiente: pendiente,
    periodo_origen: null,
    periodo_destino: '2026-11',
    activa: pendiente > 0
  } as unknown as RrhhLiquidacionDeuda
}

function pago(id: number, monto: number): RrhhLiquidacionPago {
  return { id, id_usuario: 1, monto } as unknown as RrhhLiquidacionPago
}

describe('deudas y pagos de liquidación', () => {
  it('lo pagado de más que bajó una deuda no se descuenta dos veces', () => {
    // Neto 100, deuda 50, paga 150: 50 van a la deuda (queda en 0) → saldo 0, no −50.
    const r = resumenLiquidacionDeuda({
      netoMes: 100,
      deudas: [deuda(1, 0)],
      pagos: [pago(1, 150)],
      aplicadoADeudas: 50
    })
    assert.equal(r.saldo, 0)
    assert.equal(r.pagado, 150)
  })

  it('un pago nuevo solo aplica su propio excedente', () => {
    // Ya se aplicaron 50 del primer pago; un segundo pago de 10 solo tiene 10 de excedente.
    assert.equal(excedenteSinAplicar({ netoMes: 100, pagado: 150, aplicadoADeudas: 50 }), 0)
    assert.equal(excedenteSinAplicar({ netoMes: 100, pagado: 160, aplicadoADeudas: 50 }), 10)
    assert.equal(excedenteSinAplicar({ netoMes: 100, pagado: 80, aplicadoADeudas: 0 }), 0)
    // Sin deudas que bajar, el excedente queda como pago de más (saldo negativo).
    const r = resumenLiquidacionDeuda({ netoMes: 100, deudas: [], pagos: [pago(1, 160)], aplicadoADeudas: 50 })
    assert.equal(r.saldo, -10)
  })

  it('reparte el excedente por orden de alta', () => {
    const rep = repartirFifo([deuda(5, 30), deuda(2, 40)], 50)
    assert.deepEqual(
      rep.map((x) => [x.deuda.id, x.aplica]),
      [
        [2, 40],
        [5, 10]
      ]
    )
  })

  it('arrastre: neto − pagos al neto + arrastre anterior pendiente', () => {
    // Neto 100, arrastre previo 50 sin pagar, pagó 100 → debe 50 (antes se perdía).
    assert.equal(
      saldoParaArrastre({ netoMes: 100, pagado: 100, aplicadoADeudas: 0, arrastreAnteriorPendiente: 50 }),
      50
    )
    // Pagó 150 y 50 bajaron el arrastre anterior (pendiente 0) → nada que arrastrar.
    assert.equal(
      saldoParaArrastre({ netoMes: 100, pagado: 150, aplicadoADeudas: 50, arrastreAnteriorPendiente: 0 }),
      0
    )
  })

  it('normaliza y suma aplicaciones por empleado', () => {
    const aps = normalizarAplicaciones([
      { idUsuario: 1, idDeuda: 2, idPago: 3, monto: 40 },
      { idUsuario: 1, idDeuda: 5, idPago: 3, monto: 10 },
      { idUsuario: 2, idDeuda: 6, idPago: 4, monto: 99 },
      { basura: true }
    ])
    assert.equal(aps.length, 3)
    assert.equal(totalAplicadoADeudas(aps, 1), 50)
  })

  it('el cierre digital usa el valor día configurado del período', () => {
    assert.equal(valorDiaPeriodo({ valorDiaDescuento: 60000 }), 60000)
    assert.equal(valorDiaPeriodo({}), 52232)
    const conceptos = conceptosMiLiquidacionDigital(
      {
        id_usuario: 1,
        nombre: 'Ana',
        dias_trabajados: 20,
        tardanzas: 3,
        minutos_tarde: 60,
        ausencias: 0,
        he50: 0,
        he100: 0,
        costo_he: 0,
        faltas_injustificadas: 0,
        anticipacion_sueldo: 0,
        descuento_comida: 0,
        detalle_json: {}
      } as never,
      0,
      undefined,
      undefined,
      undefined,
      60000
    )
    assert.equal(conceptos.find((c) => c.codigo === 'FTARD')?.importe, 60000)
  })
})
