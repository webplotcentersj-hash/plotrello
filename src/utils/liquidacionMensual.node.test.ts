import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CARGAS_SOCIALES_DEFAULT,
  VALOR_DIA_DESCUENTO_DEFAULT,
  armarLiquidacionEmpleado,
  descuentoPorFaltas,
  descuentoPorTardanzas,
  diasDescuentoPorTardanzas
} from './liquidacionMensual.ts'
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
  it('descuenta cada falta injustificada a valor día fijo', () => {
    assert.equal(descuentoPorFaltas(1), VALOR_DIA_DESCUENTO_DEFAULT)
    assert.equal(descuentoPorFaltas(2, 52232), 104464)
  })

  it('descuenta 1 día cada 3 tardanzas', () => {
    assert.equal(diasDescuentoPorTardanzas(0), 0)
    assert.equal(diasDescuentoPorTardanzas(2), 0)
    assert.equal(diasDescuentoPorTardanzas(3), 1)
    assert.equal(diasDescuentoPorTardanzas(5), 1)
    assert.equal(diasDescuentoPorTardanzas(6), 2)
    assert.equal(descuentoPorTardanzas(3), VALOR_DIA_DESCUENTO_DEFAULT)
    assert.equal(descuentoPorTardanzas(6, 52232), 104464)
    assert.equal(descuentoPorTardanzas(2), 0)
  })

  it('arma el neto con extras, faltas a valor día y aportes', () => {
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ ausencias: 1, tardanzas: 1, minutosTardeTotal: 60, extra50: 2, extra100: 1 }),
      montos: { netoManual: null, precioHora: 1000, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
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
    // 1 falta injustificada detectada en fechasFaltas → $52.232; 1 tardanza no completa bloque
    assert.equal(fila.descuentoFaltas, fila.faltas * VALOR_DIA_DESCUENTO_DEFAULT)
    assert.equal(fila.descuentoTardanzas, 0)
    assert.equal(fila.diasDescuentoTardanzas, 0)
    assert.equal(fila.valorDiaDescuento, VALOR_DIA_DESCUENTO_DEFAULT)
    assert.equal(fila.totalAportes, 51000)
    assert.equal(fila.haberes, 305000)
    assert.equal(fila.netoCalculado, roundExpected(fila.haberes - fila.descuentoFaltas - fila.descuentoTardanzas - fila.totalAportes))
    assert.equal(fila.neto, fila.netoCalculado)
    assert.equal(fila.netoManual, false)
    assert.equal(fila.contribuciones.find((c) => c.id === 'co-art')?.importe, 0)
    assert.ok(fila.totalContribuciones > 0)
  })

  it('no descuenta faltas justificadas ni permisos aprobados', () => {
    const horario = { entrada: '08:00', salida: '17:00', horas: 9, trabajaSabado: false }
    const dias = ['2026-10-05', '2026-10-06', '2026-10-07']
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ ausencias: 0, justificados: 2, diasConEntrada: 0, diasExigibles: 1 }),
      montos: { netoManual: null, precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      valorDiaDescuento: 52232,
      novedades: [
        {
          id: 1,
          id_usuario: 1,
          id_solicitud_permiso: null,
          grupo: 'falta',
          codigo: 'falta_justificada_enfermedad',
          fecha_desde: '2026-10-05',
          fecha_hasta: '2026-10-05',
          duracion_minutos: null,
          horas_extra_cantidad: null,
          observaciones: null,
          adjuntos: [],
          registrado_por: null,
          firma_data_url: null,
          firmado_at: null,
          created_at: '',
          updated_at: ''
        }
      ],
      permisos: [
        {
          id: 10,
          id_usuario: 1,
          tipo_solicitud: 'permiso',
          titulo: 'Trámite',
          descripcion: null,
          fecha_solicitud: '2026-10-01',
          fecha_inicio: '2026-10-06',
          fecha_fin: '2026-10-06',
          dias_solicitados: 1,
          estado: 'aprobado',
          aprobado_por: 1,
          fecha_aprobacion: '2026-10-01',
          motivo_rechazo: null,
          observaciones: null,
          archivo_adjunto_url: null,
          created_at: '',
          updated_at: ''
        }
      ],
      dias,
      fechaDesde: '2026-10-05',
      fechaHasta: '2026-10-07',
      // Solo el 7 es falta injustificada (sin marca ni justificación)
      asistencia: [],
      horariosPorMes: { '2026-10': { 1: horario } }
    })

    assert.deepEqual(fila.fechasJustificadas, ['2026-10-05', '2026-10-06'])
    assert.deepEqual(fila.fechasFaltas, ['2026-10-07'])
    assert.equal(fila.faltas, 1)
    assert.equal(fila.descuentoFaltas, 52232)
  })

  it('descuenta suspensión a valor día y media jornada al 50% después', () => {
    const horario = { entrada: '08:00', salida: '17:00', horas: 9, trabajaSabado: false }
    // Lun 5–mar 6 suspensión; mié 7 media jornada con marca
    const dias = ['2026-10-05', '2026-10-06', '2026-10-07']
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ diasConEntrada: 1, diasExigibles: 3 }),
      montos: { netoManual: null, precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      valorDiaDescuento: 52232,
      novedades: [
        {
          id: 9,
          id_usuario: 1,
          id_solicitud_permiso: null,
          grupo: 'suspension',
          codigo: 'suspension',
          fecha_desde: '2026-10-05',
          fecha_hasta: '2026-10-06',
          duracion_minutos: null,
          horas_extra_cantidad: null,
          observaciones: 'Sanción',
          adjuntos: [],
          registrado_por: null,
          firma_data_url: null,
          firmado_at: null,
          created_at: '',
          updated_at: ''
        }
      ],
      permisos: [],
      dias,
      fechaDesde: '2026-10-05',
      fechaHasta: '2026-10-07',
      asistencia: [
        {
          id: 1,
          id_usuario: 1,
          fecha: '2026-10-07',
          hora_entrada: '2026-10-07T08:00:00-03:00',
          hora_salida: '2026-10-07T12:00:00-03:00',
          horas_trabajadas: 4,
          tipo_registro: 'normal',
          observaciones: null,
          created_at: '',
          updated_at: ''
        }
      ],
      horariosPorMes: { '2026-10': { 1: horario } }
    })

    assert.deepEqual(fila.fechasSuspensiones, ['2026-10-05', '2026-10-06'])
    assert.equal(fila.descuentoSuspensiones, 104464)
    assert.deepEqual(fila.fechasMediaJornada, ['2026-10-07'])
    assert.equal(fila.descuentoMediaJornada, 26116)
    assert.equal(fila.faltas, 0)
    assert.equal(fila.descuentoFaltas, 0)
  })

  it('aplica bloque de 3 tardanzas como 1 día al neto', () => {
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ ausencias: 0, tardanzas: 3, minutosTardeTotal: 90, extra50: 0, extra100: 0 }),
      montos: { netoManual: null, precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      valorDiaDescuento: 52232,
      novedades: [],
      permisos: [],
      dias: ['2026-10-01'],
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-31',
      // Sin marcar falta por el día único del período: asistencia presente
      asistencia: [
        {
          id: 1,
          id_usuario: 1,
          fecha: '2026-10-01',
          hora_entrada: '2026-10-01T09:00:00-03:00',
          hora_salida: '2026-10-01T17:00:00-03:00',
          horas_trabajadas: 8,
          tipo_registro: 'tarde',
          observaciones: null,
          created_at: '',
          updated_at: ''
        }
      ],
      horariosPorMes: {
        '2026-10': { 1: { entrada: '08:00', salida: '17:00', horas: 9, trabajaSabado: false } }
      }
    })

    assert.equal(fila.faltas, 0)
    assert.equal(fila.descuentoFaltas, 0)
    assert.equal(fila.diasDescuentoTardanzas, 1)
    assert.equal(fila.descuentoTardanzas, 52232)
    assert.equal(fila.netoCalculado, fila.haberes - 52232 - fila.totalAportes)
  })

  it('respeta neto manual editable y sigue descontando aportes del calculado', () => {
    const fila = armarLiquidacionEmpleado({
      id: 1,
      nombre: 'Ana',
      stats: stats({ ausencias: 1, tardanzas: 1, minutosTardeTotal: 60, extra50: 2, extra100: 1 }),
      montos: { netoManual: 200000, precioHora: 1000, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
      precioHoraDefault: 0,
      cargas: CARGAS_SOCIALES_DEFAULT,
      novedades: [],
      permisos: [],
      dias: ['2026-10-01'],
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-31'
    })

    assert.equal(fila.totalAportes, 51000)
    assert.equal(fila.netoManual, true)
    assert.equal(fila.neto, 200000)
    assert.equal(
      fila.netoCalculado,
      roundExpected(fila.haberes - fila.descuentoFaltas - fila.descuentoTardanzas - fila.totalAportes)
    )
  })

  it('paga el domingo y el feriado al doble solo si vino, y no los cuenta como falta', () => {
    assert.equal(nombreFeriado('2026-10-12'), 'Día del Respeto a la Diversidad Cultural')
    assert.equal(nombreFeriado('2026-10-04'), null) // domingo, no feriado
    assert.ok(nombreFeriado('2026-03-23')) // puente turístico 2026

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
      montos: { netoManual: null, precioHora: 1000, sueldoBase: 0, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
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
      montos: { netoManual: null, precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
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
      montos: { netoManual: null, precioHora: 0, sueldoBase: 300000, sueldoBlanco: 0, sueldoSinDeclarar: 0 },
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

    assert.equal(conAnios.antiguedadAnios, 6)
    assert.equal(conAnios.adicionalAntiguedadCompleto, 18000)
    assert.equal(conAnios.factorProporcional, 1)
    assert.equal(conAnios.adicionalAntiguedad, 18000)
  })
})

function roundExpected(n: number): number {
  return Math.round(n * 100) / 100
}
