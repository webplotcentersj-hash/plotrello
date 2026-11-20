import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { completarItemDesdeLegajo, faltantesItem, fechaPagoLegal } from './rrhhLibroHidratar.ts'

const base = {
  cuil: '',
  n_legajo: 0,
  banco: null as string | null,
  cbu: null as string | null,
  codigo_os: null as string | null,
  categoria: null as string | null,
  fecha_ingreso: null as string | null,
  conyuge: false,
  hijos: 0,
  forma_pago: '1',
  sueldo_basico: 500000
}

describe('libro: datos desde el legajo', () => {
  it('llena lo vacío, toma la familia del legajo y pasa a acreditación con CBU', () => {
    const r = completarItemDesdeLegajo(base, {
      cuil: '20-12345678-3',
      n_legajo: 12,
      banco: 'Banco San Juan',
      cbu: '0450012345678901234567',
      codigo_os: '126205',
      categoria: 'Oficial',
      fecha_ingreso: '2022-03-01',
      conyuge: true,
      hijos: 2
    })
    assert.equal(r.cuil, '20-12345678-3')
    assert.equal(r.n_legajo, 12)
    assert.equal(r.banco, 'Banco San Juan')
    assert.equal(r.codigo_os, '126205')
    assert.equal(r.conyuge, true)
    assert.equal(r.hijos, 2)
    assert.equal(r.forma_pago, '3')
    assert.deepEqual(faltantesItem(r), [])
  })

  it('no pisa lo ya cargado en el libro', () => {
    const r = completarItemDesdeLegajo(
      { ...base, cuil: '27111111114', categoria: 'Administrativa', forma_pago: '2' },
      { cuil: '20999999990', categoria: 'Otra', cbu: '0450012345678901234567' }
    )
    assert.equal(r.cuil, '27111111114')
    assert.equal(r.categoria, 'Administrativa')
    assert.equal(r.forma_pago, '2')
  })

  it('marca los datos faltantes', () => {
    assert.deepEqual(faltantesItem({ ...base, sueldo_basico: 0 }), [
      'CUIL',
      'CBU',
      'Categoría',
      'Ingreso',
      'Obra social',
      'Básico'
    ])
  })

  it('fecha de pago: 4.º día hábil del mes siguiente (art. 128 LCT)', () => {
    // dic-2026: 1 mar, 2 mié, 3 jue, 4 vie.
    assert.equal(fechaPagoLegal('2026-11'), '2026-12-04')
    // ene-2027: 1 feriado (vie), 4 lun, 5, 6, 7.
    assert.equal(fechaPagoLegal('2026-12'), '2027-01-07')
  })
})
