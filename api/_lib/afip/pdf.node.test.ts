import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAfipSdkPdfRequest, nombreArchivoPdfAfip, templatePdfAfip } from './pdf.ts'

const emisor = {
  cuit: '30715518801',
  razon_social: 'PLOT CENTER SRL',
  domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
  condicion_iva: 'Responsable Inscripto',
  ingresos_brutos: '30-71551880-1',
  fecha_inicio_actividades: '2017-01-27'
}

describe('PDF AfipSDK', () => {
  it('elige el template oficial según el tipo', () => {
    assert.equal(templatePdfAfip('Factura A'), 'invoice-a')
    assert.equal(templatePdfAfip('Factura B'), 'invoice-b')
    assert.equal(templatePdfAfip('Factura C'), 'invoice-c')
    assert.equal(templatePdfAfip('Nota de Crédito A'), 'credit-note-a')
    assert.equal(templatePdfAfip('Nota de Débito B'), 'debit-note-b')
  })

  it('arma el payload de Factura A con CAE, CUIT emisor y desglose de IVA', () => {
    const req = buildAfipSdkPdfRequest(
      {
        tipo_comprobante: 'Factura A',
        punto_venta: 14,
        numero_comprobante: 3,
        numero_factura: '0014-00000003',
        fecha_emision: '2026-10-06',
        fecha_vencimiento_cae: '2026-10-16',
        cliente_nombre: 'Alejandro Chavez',
        cliente_dni_cuit: '20358577076',
        cliente_condicion_iva: 'Responsable Inscripto',
        concepto: 1,
        subtotal: 86.36,
        iva: 18.14,
        total: 104.5,
        cae: '86064129315166',
        items: [
          {
            item_numero: 1,
            descripcion: 'servicios',
            cantidad: 1,
            precio_unitario: 86.36,
            subtotal: 86.36,
            iva_porcentaje: 21,
            iva_monto: 18.14,
            total: 104.5
          }
        ]
      },
      emisor
    )

    assert.equal(req.file_name, 'Factura_A_0014-00000003.pdf')
    assert.equal(req.template.name, 'invoice-a')
    assert.equal(req.template.params.sales_point, 14)
    assert.equal(req.template.params.voucher_number, 3)
    assert.equal(req.template.params.issuer_cuit, 30715518801)
    assert.equal(req.template.params.cae, 86064129315166)
    assert.equal(req.template.params.issue_date, '06/10/2026')
    assert.equal(req.template.params.receiver_document_type, 80)
    assert.equal(req.template.params.total_amount, 104.5)
    const items = req.template.params.items as Array<{ vat_rate: number; subtotal: number }>
    assert.equal(items[0].vat_rate, 21)
    assert.equal(items[0].subtotal, 86.36)
    const iva = req.template.params.vat_breakdown as Array<{ vat_rate_id: number }>
    assert.equal(iva[0].vat_rate_id, 5)
  })

  it('en una nota de crédito referencia el comprobante original', () => {
    const req = buildAfipSdkPdfRequest(
      {
        tipo_comprobante: 'Nota de Crédito A',
        punto_venta: 14,
        numero_comprobante: 1,
        fecha_emision: '2026-10-06',
        cliente_nombre: 'Cliente',
        cliente_dni_cuit: '30715518801',
        subtotal: 100,
        iva: 21,
        total: 121,
        cae: '12345678901234'
      },
      emisor,
      {
        tipo_comprobante: 'Factura A',
        punto_venta: 14,
        numero_comprobante: 3,
        fecha_emision: '2026-10-06'
      }
    )
    assert.equal(req.template.name, 'credit-note-a')
    const asoc = req.template.params.associated_vouchers as Array<{ voucher_type: number; voucher_number: number }>
    assert.equal(asoc[0].voucher_type, 1)
    assert.equal(asoc[0].voucher_number, 3)
  })

  it('nombra el archivo con tipo y número', () => {
    assert.equal(
      nombreArchivoPdfAfip({
        tipo_comprobante: 'Factura A',
        punto_venta: 14,
        numero_comprobante: 3,
        numero_factura: '0014-00000003',
        fecha_emision: '2026-10-06',
        cliente_nombre: 'X',
        subtotal: 1,
        iva: 0,
        total: 1
      }),
      'Factura_A_0014-00000003.pdf'
    )
  })
})
