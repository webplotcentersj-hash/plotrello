import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ClienteRecord } from '../types/api'
import { analizarParDuplicado } from './clienteDuplicados.ts'

function c(partial: Partial<ClienteRecord> & { id: number; nombre: string }): ClienteRecord {
  return {
    dni_cuit: null,
    telefono: null,
    email: null,
    apellido: null,
    empresa: null,
    activo: true,
    ...partial
  }
}

describe('analizarParDuplicado', () => {
  it('no agrupa Alerio con Alejandro por el token corto ale', () => {
    const a = c({ id: 1, nombre: 'Ale - Plot Center Chavez', apellido: 'Chavez' })
    const b = c({ id: 2, nombre: 'Alerio' })
    assert.equal(analizarParDuplicado(a, b).duplicado, false)
  })

  it('une fichas con mismo teléfono aunque el nombre varíe', () => {
    const a = c({
      id: 1,
      nombre: 'Ale - Plot Center Chavez',
      apellido: 'Chavez',
      telefono: '2645468012'
    })
    const b = c({
      id: 2,
      nombre: 'Alejandro Chavez',
      apellido: 'Chavez',
      telefono: '2645468012'
    })
    const r = analizarParDuplicado(a, b)
    assert.equal(r.duplicado, true)
    assert.ok(r.razones.includes('telefono'))
  })

  it('une por mismo apellido + nombre similar sin hard match', () => {
    const a = c({ id: 1, nombre: 'Alejandro', apellido: 'Chavez' })
    const b = c({ id: 2, nombre: 'alejandro chavez', apellido: 'Chavez' })
    assert.equal(analizarParDuplicado(a, b).duplicado, true)
  })
})
