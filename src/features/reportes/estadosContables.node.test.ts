import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  antiguedad,
  composicionEgresos,
  estadoResultados,
  evolucionMensual,
  flujoFondos,
  lineaResultado,
  mesesEntre,
  periodoAnterior,
  situacionPatrimonial,
  tramoDe,
  type Movimiento,
  type SaldoCuenta
} from './estadosContables.ts'

const mv = (fecha: string, codigo: string, nombre: string, tipo: Movimiento['tipo'], debe: number, haber: number): Movimiento => ({
  fecha,
  codigo,
  nombre,
  tipo,
  debe,
  haber
})

// Octubre y noviembre: ventas, descuento, costo, gastos de cada tipo
const movs: Movimiento[] = [
  mv('2026-10-05', '4.1.1.01', 'Ventas de productos', 'Ingreso', 0, 800),
  mv('2026-11-03', '4.1.1.01', 'Ventas de productos', 'Ingreso', 0, 1000),
  mv('2026-11-04', '4.1.1.09', 'Descuentos otorgados', 'Ingreso', 50, 0),
  mv('2026-11-05', '4.2.1.01', 'Intereses ganados', 'Ingreso', 0, 20),
  mv('2026-11-06', '5.1.1.02', 'Materiales', 'Costo', 400, 0),
  mv('2026-11-07', '6.1.2.01', 'Alquiler', 'Gasto', 150, 0),
  mv('2026-11-08', '6.2.1.01', 'Comisiones', 'Gasto', 40, 0),
  mv('2026-11-09', '6.3.1.02', 'Impuesto al cheque', 'Gasto', 10, 0),
  mv('2026-11-10', '6.4.1.01', 'Ganancias', 'Gasto', 70, 0),
  // disponibilidades
  mv('2026-10-05', '1.1.1.01', 'Caja', 'Activo', 800, 0),
  mv('2026-11-03', '1.1.1.02', 'Banco', 'Activo', 1000, 0),
  mv('2026-11-07', '1.1.1.02', 'Banco', 'Activo', 0, 150)
]

describe('estado de resultados (RT 9)', () => {
  it('clasifica por línea', () => {
    assert.equal(lineaResultado('4.1.1.09', 'Ingreso'), 'ventas')
    assert.equal(lineaResultado('4.2.1.01', 'Ingreso'), 'otros')
    assert.equal(lineaResultado('6.2.4.01', 'Gasto'), 'comercializacion')
    assert.equal(lineaResultado('6.9.9.99', 'Gasto'), 'administracion')
    assert.equal(lineaResultado('1.1.1.01', 'Activo'), null)
  })

  it('arma las líneas, márgenes y el resultado neto del período', () => {
    const er = estadoResultados(movs, '2026-11-01', '2026-11-30')
    assert.equal(er.ventas, 950, 'ventas menos descuentos')
    assert.equal(er.costo, -400)
    assert.equal(er.bruto, 550)
    assert.equal(er.administracion, -150)
    assert.equal(er.comercializacion, -40)
    assert.equal(er.financieros, -10)
    assert.equal(er.otros, 20)
    assert.equal(er.antesImpuesto, 370)
    assert.equal(er.ganancias, -70)
    assert.equal(er.neto, 300)
    assert.equal(Math.round(er.margenBruto!), 58)
    assert.deepEqual(er.detalle.ventas.map((d) => d.codigo), ['4.1.1.01', '4.1.1.09'])
  })

  it('sin ventas los márgenes no se calculan', () => {
    const er = estadoResultados(movs, '2026-01-01', '2026-01-31')
    assert.equal(er.neto, 0)
    assert.equal(er.margenBruto, null)
  })
})

describe('situación patrimonial', () => {
  const s = (codigo: string, nombre: string, tipo: SaldoCuenta['tipo'], debe: number, haber: number): SaldoCuenta => ({ codigo, nombre, tipo, debe, haber })
  const saldos: SaldoCuenta[] = [
    s('1.1.1.01', 'Caja', 'Activo', 500, 100),
    s('1.1.3.01', 'Deudores por ventas', 'Activo', 1210, 210),
    s('1.1.5.01', 'Materias primas', 'Activo', 300, 0),
    s('1.2.1.01', 'Impresoras', 'Activo', 2000, 0),
    s('1.2.1.09', 'Amortización acumulada', 'Activo', 0, 400),
    s('2.1.1.01', 'Proveedores', 'Pasivo', 100, 600),
    s('2.1.3.01', 'IVA Débito Fiscal', 'Pasivo', 0, 210),
    s('2.2.1.01', 'Préstamo largo plazo', 'Pasivo', 0, 500),
    s('3.1.1.01', 'Capital social', 'Patrimonio', 0, 1500),
    s('4.1.1.01', 'Ventas', 'Ingreso', 0, 1000),
    s('6.1.2.01', 'Alquiler', 'Gasto', 410, 0)
  ]
  const plan = [
    { codigo: '1.1.1', nombre: 'Caja y bancos', tipo: 'Activo' as const },
    { codigo: '1.2.1', nombre: 'Bienes de uso', tipo: 'Activo' as const }
  ]

  it('corriente / no corriente, PN con el resultado no cerrado, y balancea', () => {
    const sp = situacionPatrimonial(saldos, plan)
    assert.equal(sp.activoCorriente.total, 400 + 1000 + 300)
    assert.equal(sp.activoNoCorriente.total, 1600, 'neto de amortización')
    assert.equal(sp.activoNoCorriente.rubros[0].nombre, 'Bienes de uso')
    assert.equal(sp.pasivoCorriente.total, 710)
    assert.equal(sp.pasivoNoCorriente.total, 500)
    assert.equal(sp.resultadoNoCerrado, 590)
    assert.equal(sp.patrimonioNeto, 2090)
    assert.equal(sp.diferencia, 0)
  })

  it('índices', () => {
    const { indices, disponibilidades, bienesDeCambio } = situacionPatrimonial(saldos, plan)
    assert.equal(disponibilidades, 400)
    assert.equal(bienesDeCambio, 300)
    assert.equal(indices.liquidezCorriente!.toFixed(2), (1700 / 710).toFixed(2))
    assert.equal(indices.pruebaAcida!.toFixed(2), (1400 / 710).toFixed(2))
    assert.equal(indices.endeudamiento!.toFixed(2), (1210 / 2090).toFixed(2))
    assert.equal(indices.capitalTrabajo, 990)
  })
})

describe('series, aging y períodos', () => {
  it('meses entre fechas', () => {
    assert.deepEqual(mesesEntre('2026-11-15', '2027-02-01'), ['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('evolución mensual de ingresos y egresos', () => {
    const ev = evolucionMensual(movs, '2026-10-01', '2026-11-30')
    assert.deepEqual(ev[0], { mes: '2026-10', ingresos: 800, egresos: 0, resultado: 800 })
    assert.deepEqual(ev[1], { mes: '2026-11', ingresos: 970, egresos: 670, resultado: 300 })
  })

  it('flujo de fondos de caja y bancos con saldo acumulado', () => {
    const f = flujoFondos(movs, '2026-10-01', '2026-11-30', 100)
    assert.deepEqual(f[0], { mes: '2026-10', entradas: 800, salidas: 0, neto: 800, saldo: 900 })
    assert.deepEqual(f[1], { mes: '2026-11', entradas: 1000, salidas: 150, neto: 850, saldo: 1750 })
  })

  it('composición de egresos por rubro', () => {
    const c = composicionEgresos(movs, '2026-11-01', '2026-11-30', [{ codigo: '5.1.1', nombre: 'Costo de ventas', tipo: 'Costo' }])
    assert.equal(c[0].nombre, 'Costo de ventas')
    assert.equal(c[0].valor, 400)
    assert.equal(c.length, 5)
  })

  it('antigüedad: tramos, vencido y principales deudores', () => {
    const hoy = '2026-11-17'
    assert.equal(tramoDe({ nombre: 'a', pendiente: 1, vencimiento: '2026-11-20', emision: '2026-11-01' }, hoy), 'A vencer')
    assert.equal(tramoDe({ nombre: 'a', pendiente: 1, vencimiento: null, emision: '2026-10-01' }, hoy), '1–30 días', 'sin vencimiento: 30 días desde la emisión')
    const a = antiguedad(
      [
        { nombre: 'Ana', pendiente: 100, vencimiento: '2026-12-01', emision: '2026-11-01' },
        { nombre: 'Beto', pendiente: 300, vencimiento: '2026-07-01', emision: '2026-06-01' },
        { nombre: 'Ana', pendiente: 50, vencimiento: '2026-10-10', emision: '2026-09-10' },
        { nombre: 'Cero', pendiente: 0, vencimiento: null, emision: '2026-01-01' }
      ],
      hoy
    )
    assert.equal(a.total, 450)
    assert.equal(a.vencido, 350)
    assert.equal(a.tramos.find((t) => t.tramo === 'Más de 90')!.importe, 300)
    assert.deepEqual(a.principales[0], { nombre: 'Beto', importe: 300 })
  })

  it('período anterior: mismos meses previos o misma cantidad de días', () => {
    assert.deepEqual(periodoAnterior('2026-11-01', '2026-11-30'), { desde: '2026-10-01', hasta: '2026-10-31' })
    assert.deepEqual(periodoAnterior('2026-01-01', '2026-03-31'), { desde: '2025-10-01', hasta: '2025-12-31' })
    assert.deepEqual(periodoAnterior('2026-11-01', '2026-11-17'), { desde: '2026-10-01', hasta: '2026-10-17' }, 'mes en curso: mismos días')
    assert.deepEqual(periodoAnterior('2026-03-01', '2026-03-31'), { desde: '2026-02-01', hasta: '2026-02-28' })
    assert.deepEqual(periodoAnterior('2026-03-01', '2026-03-30'), { desde: '2026-02-01', hasta: '2026-02-28' }, 'recorta al fin de febrero')
    assert.deepEqual(periodoAnterior('2026-01-01', '2026-11-17'), { desde: '2025-01-01', hasta: '2025-11-17' }, 'año en curso: mismo período del año anterior')
    assert.deepEqual(periodoAnterior('2026-11-05', '2026-11-14'), { desde: '2026-10-26', hasta: '2026-11-04' }, 'rango libre: misma cantidad de días')
  })
})
