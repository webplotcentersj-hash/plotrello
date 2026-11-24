import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  linkLoginPortalCliente,
  mensajeWhatsappAccesoPortal,
  urlWhatsappAccesoPortal
} from './portalClienteCredenciales.ts'

describe('portalClienteCredenciales', () => {
  it('arma link de login y mensaje con usuario, contraseña y URL', () => {
    const link = linkLoginPortalCliente('https://trello.plotcenter.com.ar')
    assert.equal(link, 'https://trello.plotcenter.com.ar/cliente/login')
    const msg = mensajeWhatsappAccesoPortal({
      nombre: 'Juan',
      usuario: 'juan@mail.com',
      password: 'Secreta123!',
      link
    })
    assert.match(msg, /¡Hola Juan!/)
    assert.match(msg, /Usuario: juan@mail\.com/)
    assert.match(msg, /Contraseña: Secreta123!/)
    assert.match(msg, /trello\.plotcenter\.com\.ar\/cliente\/login/)
  })

  it('arma wa.me con teléfono AR', () => {
    const url = urlWhatsappAccesoPortal({
      telefono: '2644123456',
      usuario: 'a@b.com',
      password: 'Pp1234567890!',
      link: 'https://example.com/cliente/login'
    })
    assert.ok(url.startsWith('https://wa.me/542644123456?text='))
    assert.ok(url.includes(encodeURIComponent('a@b.com')))
  })
})
