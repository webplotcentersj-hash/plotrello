import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calcularLineaItem,
  calcularTotalesFactura,
  cuitValido,
  inferirTipoFactura,
  redondear2,
  tiposFacturaPermitidos,
  validarReceptorComprobante
} from './afipFacturaUi.ts'

describe('redondeo y cálculo por línea', () => {
  it('redondea mitades hacia arriba pese a la coma flotante', () => {
    assert.equal(redondear2(2.205), 2.21)
    assert.equal(redondear2(1.005), 1.01)
    assert.equal(redondear2(-2.205), -2.21)
  })

  it('dos ítems de $10,50 al 21%: el IVA total es la suma de las líneas', () => {
    const items = [
      { cantidad: 1, precio_unitario: 10.5, descuento: 0, iva_porcentaje: 21 },
      { cantidad: 1, precio_unitario: 10.5, descuento: 0, iva_porcentaje: 21 }
    ]
    const t = calcularTotalesFactura(items)
    assert.equal(t.subtotal, 21)
    assert.equal(t.iva, 4.42)
    assert.equal(t.total, 25.42)
    assert.equal(t.porAlicuota['21'].iva, 4.42)
  })

  it('precio con IVA incluido conserva el total exacto de la venta', () => {
    const l = calcularLineaItem({ cantidad: 1, precio_unitario: 100, descuento: 0, iva_porcentaje: 21 }, { preciosConIva: true })
    assert.deepEqual(l, { neto: 82.64, iva: 17.36, total: 100, alicuota: 21 })
  })

  it('IVA 0% no se convierte en 21%', () => {
    const l = calcularLineaItem({ cantidad: 2, precio_unitario: 50, descuento: 0, iva_porcentaje: 0 })
    assert.equal(l.iva, 0)
    assert.equal(l.total, 100)
  })

  it('Factura C no suma IVA', () => {
    const t = calcularTotalesFactura([{ cantidad: 1, precio_unitario: 1000, descuento: 0, iva_porcentaje: 21 }], { sinIva: true })
    assert.equal(t.iva, 0)
    assert.equal(t.total, 1000)
  })
})

describe('letra del comprobante', () => {
  it('emisor Responsable Inscripto: A a RI y monotributistas, B al resto', () => {
    assert.equal(inferirTipoFactura('20409378472', 'Responsable Inscripto', 'Responsable Inscripto'), 'Factura A')
    assert.equal(inferirTipoFactura('20409378472', 'Monotributista', 'Responsable Inscripto'), 'Factura A')
    assert.equal(inferirTipoFactura('30111222', 'Consumidor Final', 'Responsable Inscripto'), 'Factura B')
    assert.deepEqual(tiposFacturaPermitidos('Responsable Inscripto'), ['Factura A', 'Factura B'])
  })

  it('emisor monotributista: siempre C', () => {
    assert.equal(inferirTipoFactura('20409378472', 'Responsable Inscripto', 'Monotributista'), 'Factura C')
    assert.deepEqual(tiposFacturaPermitidos('Monotributista'), ['Factura C'])
  })

  it('valida CUIT y receptor según letra', () => {
    assert.equal(cuitValido('20-40937847-2'), true)
    assert.equal(cuitValido('20409378473'), false)
    assert.equal(validarReceptorComprobante('Factura A', 'Responsable Inscripto', '20409378472'), null)
    assert.match(validarReceptorComprobante('Factura A', 'Responsable Inscripto', '123') || '', /CUIT válido/)
    assert.match(validarReceptorComprobante('Factura B', 'Monotributista', '20409378472') || '', /Factura A/)
    assert.equal(validarReceptorComprobante('Factura B', 'Consumidor Final', ''), null)
  })
})
