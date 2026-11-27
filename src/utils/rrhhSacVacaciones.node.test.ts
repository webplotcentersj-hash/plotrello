import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { RrhhNovedad, SolicitudPermiso } from '../types/api'
import { calcularSac, conExtraCalculado, diasVacacionesEnMes, esMesDeSac, plusVacacional, semestreDe } from './rrhhSacVacaciones'

test('semestres y meses de pago', () => {
  assert.deepEqual(semestreDe('2026-06').meses, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'])
  assert.equal(semestreDe('2026-12').numero, 2)
  assert.equal(semestreDe('2026-12').desde, '2026-07-01')
  assert.ok(esMesDeSac('2026-06') && esMesDeSac('2026-12') && !esMesDeSac('2026-11'))
})

test('SAC = 50% de la mejor remuneración del semestre', () => {
  const r = calcularSac({
    semestre: semestreDe('2026-12'),
    remuneraciones: { '2026-07': 900000, '2026-08': 1000000, '2026-09': 950000, '2026-12': 980000 },
    fechaIngreso: '2020-03-01'
  })
  assert.equal(r.mejorRemuneracion, 1000000)
  assert.equal(r.mejorPeriodo, '2026-08')
  assert.equal(r.proporcion, 1)
  assert.equal(r.sac, 500000)
})

test('SAC proporcional si ingresó dentro del semestre', () => {
  // 2° semestre 2026: 184 días. Ingreso 1/10 → 92 días = la mitad.
  const r = calcularSac({ semestre: semestreDe('2026-12'), remuneraciones: { '2026-12': 1000000 }, fechaIngreso: '2026-10-01' })
  assert.equal(r.diasSemestre, 184)
  assert.equal(r.diasTrabajados, 92)
  assert.equal(r.sac, 250000)
})

test('plus vacacional: días × (sueldo/25 − sueldo/30)', () => {
  // 1.500.000: /25 = 60.000, /30 = 50.000 → 10.000 por día
  assert.equal(plusVacacional(1500000, 14), 140000)
  assert.equal(plusVacacional(1500000, 0), 0)
})

test('días de vacaciones dentro del mes, sin contar dos veces solicitud y novedad', () => {
  const sol = [
    { id: 1, id_usuario: 7, tipo_solicitud: 'vacaciones', estado: 'aprobado', fecha_solicitud: '2026-10-01', fecha_inicio: '2026-11-25', fecha_fin: '2026-12-08' }
  ] as SolicitudPermiso[]
  const nov = [
    { id: 2, id_usuario: 7, codigo: 'licencia_vacaciones', id_solicitud_permiso: 1, fecha_desde: '2026-11-25', fecha_hasta: '2026-12-08' },
    { id: 3, id_usuario: 8, codigo: 'licencia_vacaciones', id_solicitud_permiso: null, fecha_desde: '2026-11-10', fecha_hasta: '2026-11-16' }
  ] as unknown as RrhhNovedad[]
  const m = diasVacacionesEnMes({ periodo: '2026-11', solicitudes: sol, novedades: nov })
  assert.equal(m.get(7), 6) // 25 al 30 de noviembre
  assert.equal(m.get(8), 7)
})

test('aplicar un concepto calculado reemplaza el anterior y lo quita si es 0', () => {
  const base = [{ id: 'a', concepto: 'Premio', tipo: 'remunerativo' as const, unidad: '', base: null, monto: 100, codigo_lsd: 'PREMIO' }]
  const con = conExtraCalculado(base, { id: 's', concepto: 'SAC', tipo: 'remunerativo', unidad: 'días', base: null, monto: 500, codigo_lsd: 'SAC' })
  assert.equal(con.length, 2)
  const otra = conExtraCalculado(con, { id: 's', concepto: 'SAC', tipo: 'remunerativo', unidad: 'días', base: null, monto: 600, codigo_lsd: 'SAC' })
  assert.equal(otra.filter((x) => x.codigo_lsd === 'SAC')[0].monto, 600)
  assert.equal(conExtraCalculado(otra, { id: 's', concepto: 'SAC', tipo: 'remunerativo', unidad: 'días', base: null, monto: 0, codigo_lsd: 'SAC' }).length, 1)
})
