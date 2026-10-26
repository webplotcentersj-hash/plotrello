import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CARGAS_SOCIALES_DEFAULT, armarLiquidacionEmpleado, descuentoPorFaltas } from './liquidacionMensual.ts'
import { calcularHorasExtraDiaDetalle } from './asistenciaStats.ts'
import { nombreFeriado } from './feriadosArgentina.ts'
import type { Asistencia } from '../types/api.ts'
import type { StatsEmpleadoAsistencia } from './asistenciaStats.ts'

function stats(parcial: Partial<StatsEmpleadoAsistencia>): StatsEmpleadoAsistencia {
  return {
    id: 1,
    nombre: 'Ana',
    diasConEntrada: 20,
    tardanzas: 0,
    ausencias: 0,
    justificados: 0,
    sinMarca: 0,
    totalHoras: 160,
    totalHorasExtra: 0,
    extra50: 0,
    extra100: 0,
    costoExtra: 0,
    minutosTardeTotal: 0,
    diasExigibles: 20,
    puntualidadPct: 100,
    ...parcial
  }
}

describe('liquidación mensual', () => {
  it('descuenta una falta como la remuneración dividida 30', () => {
    assert.equal(descuentoPorFaltas(2, 300000, 1000), 20000)
  })

  it('arma el neto con extras, faltas y aportes solo sobre el blanco', () => {
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ ausencias: 1, tardanzas: 1, minutosTardeTotal: 60, extra50: 2, extra100: 1 }),
      montos: { precioHora: 1000, sueldoBase: 300000, sueldoBlanco: 200000, sueldoSinDeclarar: 100000 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      novedades: [],
      permisos: [],
      dias: ['2026-10-01'],
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-31'
    })

    assert.equal(fila.importeExtra50, 3000)
    assert.equal(fila.importeExtra100, 2000)
    assert.equal(fila.descuentoFaltas, 10000)
    assert.equal(fila.descuentoTardanzas, 1000)
    assert.equal(fila.totalAportes, 34000)
    assert.equal(fila.haberes, 305000)
    assert.equal(fila.neto, 260000)
    assert.equal(fila.contribuciones.find((c) => c.id === 'co-art')?.importe, 0)
    assert.ok(fila.totalContribuciones > 0)
  })

  it('paga el domingo y el feriado al doble solo si vino, y no los cuenta como falta', () => {
    assert.equal(nombreFeriado('2026-10-12'), 'Día del Respeto a la Diversidad Cultural')
    assert.equal(nombreFeriado('2026-10-04'), null)

    const domingo: Asistencia = {
      id: 1,
      id_usuario: 1,
      fecha: '2026-10-04',
      hora_entrada: '2026-10-04T09:00:00-03:00',
      hora_salida: '2026-10-04T13:00:00-03:00',
      horas_trabajadas: 4,
      tipo_registro: 'normal',
      observaciones: null,
      created_at: '',
      updated_at: ''
    }
    const extra = calcularHorasExtraDiaDetalle(domingo, '2026-10-04', null, [])
    assert.equal(extra.extra100, 4)
    assert.equal(extra.extra50, 0)

    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ extra100: 4, totalHorasExtra: 4, ausencias: 0 }),
      montos: { precioHora: 1000, sueldoBase: 0, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      novedades: [],
      permisos: [],
      dias: ['2026-10-03', '2026-10-04', '2026-10-12'],
      fechaDesde: '2026-10-03',
      fechaHasta: '2026-10-12',
      asistencia: [domingo],
      horariosPorMes: { '2026-10': { 1: { entrada: '08:00', salida: '17:00', horas: 9, trabajaSabado: false } } }
    })

    assert.equal(fila.domingosVino, 1)
    assert.equal(fila.horasDomingo, 4)
    assert.equal(fila.importeDomingo, 8000)
    assert.equal(fila.feriados, 1)
    assert.equal(fila.feriadosVino, 0)
    assert.equal(fila.diasNoTrabaja, 1)
    assert.equal(fila.faltas, 0)
    assert.equal(fila.importeExtra100, 8000)
  })
})
