import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ClienteRecord } from '../types/api'
import { componerDatosFusion, mejorValorCampo } from './clienteFusion.ts'

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

describe('clienteFusion', () => {
  it('elige el CUIT más completo', () => {
    const grupo = [
      c({ id: 1, nombre: 'A', dni_cuit: '31888184' }),
      c({ id: 2, nombre: 'B', dni_cuit: '20-31888184-8' })
    ]
    assert.equal(mejorValorCampo(grupo, 'dni_cuit', 1).valor, '20-31888184-8')
  })

  it('compone ficha unificada mezclando lo mejor de cada una', () => {
    const datos = componerDatosFusion(
      [
        c({
          id: 1,
          nombre: 'Ale',
          telefono: '2645468012',
          email: null
        }),
        c({
          id: 2,
          nombre: 'Alejandro Chavez',
          apellido: 'Chavez',
          email: 'ale@mail.com',
          dni_cuit: '20318881848'
        })
      ],
      1
    )
    assert.equal(datos.telefono, '2645468012')
    assert.equal(datos.email, 'ale@mail.com')
    assert.equal(datos.dni_cuit, '20318881848')
    assert.equal(datos.apellido, 'Chavez')
  })
})
