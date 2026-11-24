import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { estadoFacturacionVenta, mensajeFacturaVigente } from './facturaVigenteVenta.ts'

const fa = { id: 10, numero_factura: '0014-00000300', tipo_comprobante: 'Factura A', estado: 'Emitida', estado_afip: 'Autorizada', cae: '1', total: 4903.2 }

describe('estadoFacturacionVenta', () => {
  it('factura autorizada sin notas: vigente', () => {
    assert.equal(estadoFacturacionVenta([fa]).vigente?.id, 10)
  })

  it('nota de crédito en borrador: la factura sigue vigente y se avisa', () => {
    const nc = { id: 11, numero_factura: 'PEND-11', tipo_comprobante: 'Nota de Crédito A', estado: 'Borrador', estado_afip: 'Pendiente', total: -4903.2, id_factura_referencia: 10 }
    const e = estadoFacturacionVenta([fa, nc])
    assert.equal(e.vigente?.id, 10)
    assert.equal(e.notaCreditoPendiente?.id, 11)
    assert.match(mensajeFacturaVigente(e), /está en borrador/)
  })

  it('nota de crédito total autorizada: se puede volver a facturar', () => {
    const nc = { id: 11, tipo_comprobante: 'Nota de Crédito A', estado: 'Emitida', estado_afip: 'Autorizada', cae: '2', total: -4903.2, id_factura_referencia: 10 }
    assert.equal(estadoFacturacionVenta([fa, nc]).vigente, null)
  })

  it('nota de crédito parcial: la factura sigue vigente', () => {
    const nc = { id: 11, tipo_comprobante: 'Nota de Crédito A', estado: 'Emitida', estado_afip: 'Autorizada', cae: '2', total: -1000, id_factura_referencia: 10 }
    const e = estadoFacturacionVenta([fa, nc])
    assert.equal(e.vigente?.id, 10)
    assert.equal(e.saldoSinAcreditar, 3903.2)
    assert.match(mensajeFacturaVigente(e), /no la cubren entera/)
  })

  it('refacturada después de anular: la nueva factura es la vigente', () => {
    const nc = { id: 11, tipo_comprobante: 'Nota de Crédito A', estado: 'Emitida', estado_afip: 'Autorizada', cae: '2', total: -4903.2, id_factura_referencia: 10 }
    const fb = { ...fa, id: 12, tipo_comprobante: 'Factura B', numero_factura: '0014-00000900' }
    assert.equal(estadoFacturacionVenta([fa, nc, fb]).vigente?.id, 12)
  })

  it('borradores y anuladas no cuentan como vigentes', () => {
    const borr = { id: 13, tipo_comprobante: 'Factura B', estado: 'Borrador', estado_afip: 'Error', total: 100 }
    const anul = { ...fa, id: 14, estado: 'Anulada' }
    assert.equal(estadoFacturacionVenta([borr, anul]).vigente, null)
  })
})
