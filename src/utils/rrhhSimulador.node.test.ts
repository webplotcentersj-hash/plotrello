import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALICUOTAS_LCT_DEFAULT, numerosLiquidacion, type RrhhLibroSueldos, type RrhhLibroSueldosItem } from './rrhhLibroSueldos'
import { simular, totales, type Escenario } from './rrhhSimulador'

const libro: RrhhLibroSueldos = {
  id: 1,
  periodo: '2026-08',
  estado: 'borrador',
  empresa_nombre: 'PLOT CENTER SRL',
  empresa_domicilio: 'x',
  empresa_cuit: '30715518801',
  jurisdiccion: 'SAN JUAN',
  cct_default: '0409/05',
  art_codigo: '00000',
  scvo_cia: 'x',
  banco: null,
  fecha_pago: null,
  scvo_default: 0,
  os_base_mult: 1,
  nro_liquidacion: 1,
  dias_base: 30,
  tipo_empleador: '1',
  codigo_actividad: '',
  codigo_localidad: '',
  codigo_os_default: null,
  importe_detraer: 0,
  alicuotas: { ...ALICUOTAS_LCT_DEFAULT },
  notas: null,
  id_lote_recibos: null,
  created_by: null,
  created_at: ''
}

const item = (id: number, basico: number, categoria: string, extras: RrhhLibroSueldosItem['extras'] = []): RrhhLibroSueldosItem => ({
  id,
  id_libro: 1,
  id_usuario: id,
  incluido: true,
  n_legajo: id,
  apellido_nombre: `Empleado ${id}`,
  cuil: '20123456786',
  categoria,
  fecha_ingreso: '2020-01-01',
  antiguedad_reconocida: 0,
  anios_antiguedad: 0,
  dias: 30,
  etiqueta_basico: 'Sueldo básico',
  sueldo_basico: basico,
  adicional_antiguedad: 0,
  scvo: 0,
  banco: null,
  cbu: null,
  forma_pago: '1',
  conyuge: false,
  hijos: 0,
  cct: true,
  cct_codigo: '0409/05',
  cobertura_scvo: true,
  situacion_revista: '01',
  condicion: '01',
  actividad: null,
  modalidad: '001',
  codigo_os: null,
  horas_trabajadas: 0,
  extras
})

const sin: Escenario = { aumentoPct: 0, categoria: '', sumaRemunerativa: 0, sumaNoRemunerativa: 0, altas: [] }

test('sin cambios, el simulado es igual al actual', () => {
  const t = totales(simular({ libro, items: [item(1, 1000000, 'Taller'), item(2, 800000, 'Diseño')], escenario: sin }))
  assert.equal(t.actual.bruto, 1800000)
  assert.equal(t.simulado.costo, t.actual.costo)
})

test('un 10% sube el bruto 10% y el costo con sus cargas', () => {
  const items = [item(1, 1000000, 'Taller'), item(2, 800000, 'Diseño')]
  const t = totales(simular({ libro, items, escenario: { ...sin, aumentoPct: 10 } }))
  assert.equal(Math.round(t.simulado.bruto), 1980000)
  assert.ok(t.simulado.costo > t.actual.costo * 1.09 && t.simulado.costo < t.actual.costo * 1.11)
})

test('el aumento puede aplicarse a una sola categoría', () => {
  const items = [item(1, 1000000, 'Taller'), item(2, 800000, 'Diseño')]
  const filas = simular({ libro, items, escenario: { ...sin, aumentoPct: 10, categoria: 'Taller' } })
  assert.equal(Math.round(filas[0].simulado.bruto), 1100000)
  assert.equal(filas[1].simulado.bruto, filas[1].actual!.bruto)
})

test('deja afuera horas extra / inasistencias del mes y aguinaldo para comparar el sueldo normal', () => {
  const conVariables = item(1, 1000000, 'Taller', [
    { id: 'liq-HE50', concepto: 'HE 50%', tipo: 'remunerativo', unidad: 'hs', base: null, monto: 50000, codigo_lsd: 'HE50', origen: 'liq' },
    { id: 'calc-sac', concepto: 'SAC', tipo: 'remunerativo', unidad: 'días', base: null, monto: 500000, codigo_lsd: 'SAC', origen: 'calc' },
    { id: 'p', concepto: 'Presentismo', tipo: 'remunerativo', unidad: '', base: null, monto: 30000, codigo_lsd: 'PRES' }
  ])
  const t = totales(simular({ libro, items: [conVariables], escenario: sin }))
  assert.equal(t.actual.bruto, 1030000)
})

test('nuevos ingresos suman su costo; la suma no remunerativa no paga cargas', () => {
  const items = [item(1, 1000000, 'Taller')]
  const conAlta = totales(simular({ libro, items, escenario: { ...sin, altas: [{ id: 'a', categoria: 'Taller', sueldo: 900000, cantidad: 2, enConvenio: true }] } }))
  const unoSolo = numerosLiquidacion(item(9, 900000, 'Taller'), libro).costoEmpleador
  assert.ok(Math.abs(conAlta.simulado.costo - conAlta.actual.costo - 2 * unoSolo) < 2)

  const noRem = totales(simular({ libro, items, escenario: { ...sin, sumaNoRemunerativa: 100000 } }))
  assert.equal(Math.round(noRem.simulado.contribuciones), Math.round(noRem.actual.contribuciones))
  assert.equal(Math.round(noRem.simulado.costo - noRem.actual.costo), 100000)
})
