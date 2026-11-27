import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Asistencia, RrhhNovedad, SolicitudPermiso } from '../types/api'
import { resumenHallazgos, revisarLiquidacion, type EmpleadoRevision } from './rrhhRevisionLiquidacion'

// Lun 2 … Dom 8 de noviembre 2026 (sin feriados)
const dias = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
const hoy = '2026-11-20'
const horario = (sab: boolean) => ({ entrada: '08:00', salida: '17:00', horas: 9, trabajaSabado: sab })

const marca = (id: number, fecha: string, entrada: string | null, salida: string | null, extra: Partial<Asistencia> = {}): Asistencia => ({
  id: Math.random(),
  id_usuario: id,
  fecha,
  hora_entrada: entrada ? `${fecha}T${entrada}:00-03:00` : null,
  hora_salida: salida ? `${fecha}T${salida}:00-03:00` : null,
  horas_trabajadas: null,
  tipo_registro: 'normal',
  observaciones: null,
  created_at: '',
  updated_at: '',
  ...extra
})

const ana: EmpleadoRevision = { id: 1, nombre: 'Ana Pérez', cuil: '27-12345678-3', fechaIngreso: '2020-01-01' }
const semanaCompleta = (id: number, hasta = 5) => dias.slice(0, hasta).map((f) => marca(id, f, '08:00', '17:00'))

test('semana completa con marcas: sin hallazgos', () => {
  const h = revisarLiquidacion({ dias, hoy, empleados: [ana], asistencia: semanaCompleta(1), novedades: [], permisos: [], horarios: { 1: horario(false) } })
  assert.deepEqual(h, [])
})

test('día laborable sin marca ni justificación es error; el sábado sólo si trabaja sábados', () => {
  const asis = semanaCompleta(1).filter((a) => a.fecha !== '2026-11-04')
  const lunVie = revisarLiquidacion({ dias, hoy, empleados: [ana], asistencia: asis, novedades: [], permisos: [], horarios: { 1: horario(false) } })
  assert.equal(lunVie.length, 1)
  assert.equal(lunVie[0].categoria, 'sin_marca')
  assert.deepEqual(lunVie[0].fechas, ['2026-11-04'])

  const lunSab = revisarLiquidacion({ dias, hoy, empleados: [ana], asistencia: asis, novedades: [], permisos: [], horarios: { 1: horario(true) } })
  assert.deepEqual(lunSab.find((x) => x.categoria === 'sin_marca')?.fechas, ['2026-11-04', '2026-11-07'])
})

test('una novedad o un permiso aprobado justifican el día; un permiso pendiente es error', () => {
  const asis = semanaCompleta(1).filter((a) => a.fecha !== '2026-11-04' && a.fecha !== '2026-11-05')
  const nov = { id: 1, id_usuario: 1, fecha_desde: '2026-11-04', fecha_hasta: '2026-11-04', grupo: 'licencia', codigo: 'licencia_enfermedad', observaciones: null } as unknown as RrhhNovedad
  const permiso = (estado: SolicitudPermiso['estado']) =>
    ({ id: 9, id_usuario: 1, tipo_solicitud: 'permiso', titulo: 'Trámite', fecha_solicitud: '2026-11-01', fecha_inicio: '2026-11-05', fecha_fin: '2026-11-05', estado }) as SolicitudPermiso

  const ok = revisarLiquidacion({ dias, hoy, empleados: [ana], asistencia: asis, novedades: [nov], permisos: [permiso('aprobado')], horarios: { 1: horario(false) } })
  assert.deepEqual(ok, [])

  const pend = revisarLiquidacion({ dias, hoy, empleados: [ana], asistencia: asis, novedades: [nov], permisos: [permiso('pendiente')], horarios: { 1: horario(false) } })
  // El día del permiso pendiente se avisa una sola vez (no también como "sin marca").
  assert.deepEqual(pend.map((x) => x.categoria), ['permiso_pendiente'])
  assert.equal(resumenHallazgos(pend).errores, 1)
})

test('marcas incompletas, jornadas largas y legajo incompleto', () => {
  const asis = semanaCompleta(1)
  asis[0] = marca(1, '2026-11-02', '08:00', null)
  asis[1] = marca(1, '2026-11-03', '08:00', '17:00', { horas_trabajadas: 16 })
  const sinDatos: EmpleadoRevision = { ...ana, cuil: null, fechaIngreso: null }
  const h = revisarLiquidacion({ dias, hoy, empleados: [sinDatos], asistencia: asis, novedades: [], permisos: [], horarios: {} })
  const cats = h.map((x) => x.categoria).sort()
  assert.deepEqual(cats, ['jornada_larga', 'sin_cuil', 'sin_horario', 'sin_ingreso', 'sin_salida'])
})

test('antes del ingreso no hay faltas', () => {
  const nuevo: EmpleadoRevision = { ...ana, fechaIngreso: '2026-11-05' }
  const asis = semanaCompleta(1).filter((a) => a.fecha >= '2026-11-05')
  const h = revisarLiquidacion({ dias, hoy, empleados: [nuevo], asistencia: asis, novedades: [], permisos: [], horarios: { 1: horario(false) } })
  assert.deepEqual(h, [])
})
