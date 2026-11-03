import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FacturaVentaRecord } from '../types/api'
import {
  asuntoFactura,
  emailValido,
  linkCorreo,
  linkWhatsappFactura,
  mensajeFactura,
  nombreLegible,
  puedeCompartirArchivos
} from './compartirFactura.ts'

const factura: FacturaVentaRecord = {
  id: 692,
  numero_factura: '0014-00000692',
  punto_venta: 14,
  numero_comprobante: 692,
  tipo_comprobante: 'Factura B',
  fecha_emision: '2026-11-02',
  cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
  subtotal: 11607.27,
  descuento: 0,
  iva: 2437.53,
  total: 14044.8,
  estado: 'Emitida'
}

describe('nombreLegible', () => {
  it('pasa a mayúscula inicial lo que viene todo en mayúsculas', () => {
    assert.equal(nombreLegible('RODRIGUEZ ALBERTO RUBEN'), 'Rodriguez Alberto Ruben')
  })

  it('respeta conectores y siglas de sociedades', () => {
    assert.equal(nombreLegible('GRAFICA DEL SUR S.R.L.'), 'Grafica del Sur S.R.L.')
    assert.equal(nombreLegible('AGENCIA DE VIAJES SA'), 'Agencia de Viajes SA')
  })

  it('no toca lo que ya está bien escrito y omite el consumidor final', () => {
    assert.equal(nombreLegible('María de los Ángeles'), 'María de los Ángeles')
    assert.equal(nombreLegible('Consumidor Final'), '')
    assert.equal(nombreLegible(null), '')
  })
})

describe('mensaje y asunto', () => {
  it('saluda por el nombre e informa comprobante y total', () => {
    assert.equal(
      mensajeFactura(factura),
      'Hola Rodriguez Alberto Ruben, te enviamos tu Factura B 0014-00000692 por $ 14.044,80. Gracias por elegir Plot Center.'
    )
  })

  it('sin nombre usa un saludo neutro y no muestra importes negativos', () => {
    const nota: FacturaVentaRecord = {
      ...factura,
      tipo_comprobante: 'Nota de Crédito B',
      cliente_nombre: 'Consumidor Final',
      total: -14044.8
    }
    assert.equal(
      mensajeFactura(nota),
      'Hola, te enviamos tu Nota de Crédito B 0014-00000692 por $ 14.044,80. Gracias por elegir Plot Center.'
    )
  })

  it('asunto con comprobante y empresa', () => {
    assert.equal(asuntoFactura(factura), 'Factura B 0014-00000692 - Plot Center')
  })
})

describe('links', () => {
  it('WhatsApp: normaliza el teléfono argentino y lleva el mensaje codificado', () => {
    const link = linkWhatsappFactura(factura, '0264 412-3456') as string
    assert.ok(link.startsWith('https://wa.me/542644123456?text='))
    assert.equal(decodeURIComponent(link.split('?text=')[1]), mensajeFactura(factura))
  })

  it('WhatsApp: sin teléfono no hay link', () => {
    assert.equal(linkWhatsappFactura(factura, ''), undefined)
    assert.equal(linkWhatsappFactura(factura, null), undefined)
  })

  it('correo: asunto y cuerpo codificados', () => {
    const link = linkCorreo(' cliente@ejemplo.com ', asuntoFactura(factura), mensajeFactura(factura))
    assert.ok(link.startsWith('mailto:cliente@ejemplo.com?subject=Factura%20B%200014-00000692%20-%20Plot%20Center&body='))
    assert.equal(decodeURIComponent(link.split('&body=')[1]), mensajeFactura(factura))
  })

  it('valida el correo', () => {
    assert.equal(emailValido('cliente@ejemplo.com'), true)
    assert.equal(emailValido(' cliente@ejemplo.com '), true)
    assert.equal(emailValido('cliente@'), false)
    assert.equal(emailValido('cliente ejemplo.com'), false)
    assert.equal(emailValido(''), false)
  })
})

describe('puedeCompartirArchivos', () => {
  it('fuera de un navegador responde que no, sin romper', () => {
    assert.equal(puedeCompartirArchivos(), false)
  })
})
