import assert from 'node:assert/strict'
import { test } from 'node:test'
import { armarAsientoAjuste, calcularAjusteCuenta } from './ajusteInflacion'
import {
  calcularLiquidacionIva,
  periodoAnterior,
  periodoSiguiente,
  rangoPeriodo,
  totalesIvaPeriodo
} from './liquidacionIva'

test('totales de IVA: las NC restan y solo las facturas A dan crédito', () => {
  const t = totalesIvaPeriodo(
    [
      { tipo_comprobante: 'Factura A', iva: 210 },
      { tipo_comprobante: 'Nota de Crédito A', iva: -21 },
      { tipo_comprobante: 'Factura B', iva: 105 }
    ],
    [
      { tipo_comprobante: 'Factura', letra: 'A', iva: 100, percepcion_iva: 10 },
      { tipo_comprobante: 'Factura', letra: 'B', iva: 50 },
      { tipo_comprobante: 'Nota de Crédito', letra: 'A', iva: -20 }
    ]
  )
  assert.equal(t.debitoFiscal, 294)
  assert.equal(t.creditoFiscal, 80)
  assert.equal(t.percepcionesEnCompras, 10)
})

test('liquidación: débito mayor que crédito, con pagos a cuenta', () => {
  const r = calcularLiquidacionIva({
    debitoFiscal: 1000,
    creditoFiscal: 400,
    saldoTecnicoAnterior: 100,
    saldoLibreDispAnterior: 50,
    retencionesSufridas: 30,
    percepcionesSufridas: 20
  })
  assert.equal(r.saldoPeriodo, 500)
  assert.equal(r.saldoAPagar, 400)
  assert.equal(r.saldoTecnicoResultante, 0)
  assert.equal(r.saldoLibreDispResultante, 0)
})

test('liquidación: pagos a cuenta mayores que el saldo pasan a libre disponibilidad', () => {
  const r = calcularLiquidacionIva({
    debitoFiscal: 300,
    creditoFiscal: 100,
    saldoTecnicoAnterior: 0,
    saldoLibreDispAnterior: 0,
    retencionesSufridas: 250,
    percepcionesSufridas: 0
  })
  assert.equal(r.saldoAPagar, 0)
  assert.equal(r.saldoLibreDispResultante, 50)
})

test('liquidación: crédito mayor que débito deja saldo técnico a favor', () => {
  const r = calcularLiquidacionIva({
    debitoFiscal: 100,
    creditoFiscal: 400,
    saldoTecnicoAnterior: 0,
    saldoLibreDispAnterior: 10,
    retencionesSufridas: 5,
    percepcionesSufridas: 5
  })
  assert.equal(r.saldoTecnicoResultante, 300)
  assert.equal(r.saldoAPagar, 0)
  assert.equal(r.saldoLibreDispResultante, 20)
})

test('períodos', () => {
  assert.equal(periodoAnterior('2026-01'), '2025-12')
  assert.equal(periodoSiguiente('2026-12'), '2027-01')
  assert.deepEqual(rangoPeriodo('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' })
})

test('ajuste por inflación: reexpresa al índice de cierre', () => {
  const indices = { '2026-01': 100, '2026-02': 110, '2026-03': 121 }
  const r = calcularAjusteCuenta(
    [
      { periodo: '2025-12', neto: 1000 },
      { periodo: '2026-02', neto: 500 }
    ],
    indices,
    '2026-01',
    '2026-03'
  )
  // 1000 × 1,21 + 500 × (121/110) = 1210 + 550 = 1760
  assert.equal(r.saldoHistorico, 1500)
  assert.equal(r.saldoAjustado, 1760)
  assert.equal(r.ajuste, 260)
  assert.deepEqual(r.periodosSinIndice, [])
})

test('ajuste por inflación: avisa períodos sin índice y no inventa ajuste', () => {
  const r = calcularAjusteCuenta([{ periodo: '2026-02', neto: 100 }], { '2026-03': 121 }, '2026-01', '2026-03')
  assert.equal(r.ajuste, 0)
  assert.deepEqual(r.periodosSinIndice, ['2026-02'])
})

test('asiento de ajuste balancea contra RECPAM', () => {
  const a = armarAsientoAjuste(
    [
      { id_cuenta: 1, nombre: 'Rodados', ajuste: 260 },
      { id_cuenta: 2, nombre: 'Capital', ajuste: -100 }
    ],
    99
  )
  assert.equal(a.totalDebe, a.totalHaber)
  assert.equal(a.detalles.at(-1)?.id_cuenta, 99)
  assert.equal(a.detalles.at(-1)?.haber, 160)
})
