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

  it('arma el neto con extras, faltas y aportes sobre el sueldo base', () => {
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ ausencias: 1, tardanzas: 1, minutosTardeTotal: 60, extra50: 2, extra100: 1 }),
      montos: { precioHora: 1000, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
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
    assert.equal(fila.totalAportes, 51000)
    assert.equal(fila.haberes, 305000)
    assert.equal(fila.neto, 243000)
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

  it('prorratea antigüedad legal según ingreso y días laborables del período', () => {
    const horario = { entrada: '08:00', salida: '17:00', horas: 9, trabajaSabado: false }
    // Lun 5, Mar 6, Mié 7, Jue 8, Vie 9 de octubre 2026
    const dias = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      fechaIngreso: '2026-10-08',
      stats: stats({ diasConEntrada: 0, diasExigibles: 0 }),
      montos: { precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      pctAntiguedadLegal: 1,
      novedades: [],
      permisos: [],
      dias,
      fechaDesde: '2026-10-05',
      fechaHasta: '2026-10-09',
      horariosPorMes: { '2026-10': { 1: horario } }
    })

    assert.equal(fila.diasLaborablesPeriodo, 5)
    assert.equal(fila.diasDebia, 2)
    assert.equal(fila.factorProporcional, 0.4)
    // Sin años cumplidos (ingreso en el período) → antigüedad $0, pero sueldo sí proporcional
    assert.equal(fila.antiguedadAnios, 0)
    assert.equal(fila.adicionalAntiguedad, 0)
    assert.equal(fila.sueldoBase, 120000)

    const conAnios = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      fechaIngreso: '2020-01-01',
      stats: stats({ diasConEntrada: 2, diasExigibles: 2 }),
      montos: { precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      pctAntiguedadLegal: 1,
      novedades: [],
      permisos: [],
      dias,
      fechaDesde: '2026-10-05',
      fechaHasta: '2026-10-09',
      asistencia: dias.slice(3).map((fecha, i) => ({
        id: i + 1,
        id_usuario: 1,
        fecha,
        hora_entrada: `${fecha}T08:00:00-03:00`,
        hora_salida: `${fecha}T17:00:00-03:00`,
        horas_trabajadas: 9,
        tipo_registro: 'normal' as const,
        observaciones: null,
        created_at: '',
        updated_at: ''
      })),
      horariosPorMes: { '2026-10': { 1: horario } }
    })

    // Ingreso antiguo: debía los 5 días; antigüedad 6 años × 1% × 300000 = 18000 (factor 1)
    assert.equal(conAnios.diasDebia, 5)
    assert.equal(conAnios.factorProporcional, 1)
    assert.equal(conAnios.antiguedadAnios, 6)
    assert.equal(conAnios.adicionalAntiguedadCompleto, 18000)
    assert.equal(conAnios.adicionalAntiguedad, 18000)
  })
})
