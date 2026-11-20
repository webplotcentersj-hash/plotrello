import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SOLICITUD_FORM_VACIO,
  formatearDniCuit,
  validarSolicitudAltaCliente,
  type SolicitudAltaClienteForm
} from './solicitudAltaCliente.ts'

const ok: SolicitudAltaClienteForm = {
  ...SOLICITUD_FORM_VACIO,
  nombre: 'Ana',
  apellido: 'Pérez',
  dniCuit: '30.123.456',
  telefono: '264 412-3456',
  direccion: 'Av. Libertador 580, San Juan',
  email: 'ana@mail.com',
  condicionIva: 'Consumidor Final'
}

describe('solicitud de alta de cliente', () => {
  it('acepta un consumidor final con DNI', () => {
    assert.deepEqual(validarSolicitudAltaCliente(ok), {})
  })

  it('pide todos los datos obligatorios', () => {
    const e = validarSolicitudAltaCliente(SOLICITUD_FORM_VACIO)
    assert.deepEqual(Object.keys(e).sort(), ['apellido', 'condicionIva', 'direccion', 'dniCuit', 'email', 'nombre', 'telefono'])
  })

  it('exige CUIT para responsable inscripto, monotributo y exento', () => {
    const e = validarSolicitudAltaCliente({ ...ok, condicionIva: 'Monotributista' })
    assert.match(e.dniCuit || '', /CUIT/)
    // CUIT válido (dígito verificador correcto).
    assert.deepEqual(validarSolicitudAltaCliente({ ...ok, condicionIva: 'Monotributista', dniCuit: '30-71551880-1' }), {})
  })

  it('rechaza un CUIT con dígito verificador incorrecto', () => {
    assert.match(validarSolicitudAltaCliente({ ...ok, dniCuit: '30715518802' }).dniCuit || '', /no es válido/)
  })

  it('valida email y teléfono', () => {
    const e = validarSolicitudAltaCliente({ ...ok, email: 'ana@', telefono: '1234' })
    assert.ok(e.email)
    assert.ok(e.telefono)
  })

  it('formatea DNI y CUIT', () => {
    assert.equal(formatearDniCuit('30715518801'), '30-71551880-1')
    assert.equal(formatearDniCuit('30123456'), '30.123.456')
  })
})
