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

/** El detalle con cantidad y precio por unidad usa espacios que no se parten, para que el SDK no lo separe al cortar la línea. */
const sinCorte = (texto: string) => texto.replace(/ /g, ' ')

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

  it('aplana cantidades decimales: AfipSDK solo acepta enteros y 2 decimales', () => {
    const req = buildAfipSdkPdfRequest(
      {
        tipo_comprobante: 'Factura B',
        punto_venta: 14,
        numero_comprobante: 6,
        numero_factura: '0014-00000006',
        fecha_emision: '2026-10-07',
        cliente_nombre: 'MARTIN ERICA',
        cliente_dni_cuit: '31633164',
        cliente_condicion_iva: 'Consumidor Final',
        subtotal: 219925.11,
        iva: 46184.27,
        total: 266109.38,
        cae: '86406563254980',
        items: [
          {
            item_numero: 1,
            descripcion: 'VINILO DE CORTE M2 (m²)',
            cantidad: 6.25,
            precio_unitario: 32300.02,
            subtotal: 201875.11,
            iva_porcentaje: 21,
            iva_monto: 42393.77,
            total: 244268.88
          },
          {
            item_numero: 2,
            descripcion: 'VINILO IMPRESO',
            cantidad: 0.95,
            precio_unitario: 19000,
            subtotal: 18050,
            iva_porcentaje: 21,
            iva_monto: 3790.5,
            total: 21840.5
          }
        ]
      },
      emisor
    )
    const items = req.template.params.items as Array<{
      quantity: number
      unit_price: number
      subtotal: number
      description: string
    }>
    assert.equal(items[0].quantity, 1)
    assert.equal(items[0].unit_price, 244268.88)
    assert.equal(items[0].subtotal, 244268.88)
    // La cantidad y el precio por unidad (final, con IVA, en la B) van en la descripción.
    assert.equal(items[0].description, `VINILO DE CORTE M2 (m2) ${sinCorte('x 6,25 a $ 39.083,02 c/IVA')}`)
    assert.equal(items[1].quantity, 1)
    assert.equal(items[1].unit_price, 21840.5)
    assert.equal(items[1].description, `VINILO IMPRESO ${sinCorte('x 0,95 a $ 22.990,00 c/IVA')}`)
  })

  const lineaDecimal = {
    item_numero: 1,
    descripcion: 'VINILO IMPRESO + PRE CORTE X M2 (m2)',
    cantidad: 0.48,
    precio_unitario: 24181.82, // la app guarda el precio neto aunque se haya cargado con IVA incluido
    subtotal: 11607.27,
    iva_porcentaje: 21,
    iva_monto: 2437.53,
    total: 14044.8
  }

  function descripcionDecimal(tipo: string, extra: Record<string, unknown> = {}) {
    const req = buildAfipSdkPdfRequest(
      {
        tipo_comprobante: tipo,
        punto_venta: 14,
        numero_comprobante: 692,
        fecha_emision: '2026-11-02',
        cliente_nombre: 'CLIENTE',
        cliente_dni_cuit: '30715518801',
        subtotal: 11607.27,
        iva: 2437.53,
        total: 14044.8,
        cae: '86440688442835',
        items: [lineaDecimal],
        ...extra
      },
      emisor
    )
    return (req.template.params.items as Array<{ description: string }>)[0].description
  }

  it('cantidad decimal: en la B el precio por m² es el final con IVA', () => {
    assert.equal(descripcionDecimal('Factura B'), `VINILO IMPRESO + PRE CORTE X M2 (m2) ${sinCorte('x 0,48 a $ 29.260,00 c/IVA')}`)
  })

  it('cantidad decimal: en la A el precio por m² es el neto guardado, más IVA', () => {
    assert.equal(descripcionDecimal('Factura A'), `VINILO IMPRESO + PRE CORTE X M2 (m2) ${sinCorte('x 0,48 a $ 24.181,82 + IVA')}`)
  })

  it('cantidad decimal: en la C no se nombra el IVA', () => {
    const d = descripcionDecimal('Factura C', { subtotal: 14044.8, iva: 0 })
    assert.ok(!/IVA/.test(d.replace('M2 (m2)', '')), d)
  })

  it('la condición de venta es Contado salvo que el pago venza después de la emisión', () => {
    const condicion = (extra: Record<string, unknown>) =>
      buildAfipSdkPdfRequest(
        {
          tipo_comprobante: 'Factura B',
          punto_venta: 14,
          numero_comprobante: 1,
          fecha_emision: '2026-11-02',
          cliente_nombre: 'C',
          subtotal: 100,
          iva: 21,
          total: 121,
          cae: '86440688442835',
          ...extra
        },
        emisor
      ).template.params.sale_condition
    assert.equal(condicion({}), 'Contado')
    assert.equal(condicion({ fecha_vencimiento: '2026-11-02' }), 'Contado')
    assert.equal(condicion({ fecha_vencimiento: '2026-11-30' }), 'Cuenta corriente (vence 30/11/2026)')
  })

  it('una nota de crédito guardada en negativo se imprime en positivo', () => {
    const req = buildAfipSdkPdfRequest(
      {
        tipo_comprobante: 'Nota de Crédito B',
        punto_venta: 14,
        numero_comprobante: 23,
        fecha_emision: '2026-11-02',
        cliente_nombre: 'CLIENTE',
        subtotal: -11607.27,
        iva: -2437.53,
        total: -14044.8,
        cae: '86440688442835',
        items: [{ ...lineaDecimal, subtotal: -11607.27, iva_monto: -2437.53, total: -14044.8 }]
      },
      emisor,
      { tipo_comprobante: 'Factura B', punto_venta: 14, numero_comprobante: 692, fecha_emision: '2026-11-02' }
    )
    const p = req.template.params
    assert.equal(p.total_amount, 14044.8)
    assert.equal(p.vat_amount, 2437.53)
    assert.equal(p.net_amount_taxed, 11607.27)
    const linea = (p.items as Array<{ unit_price: number; subtotal: number; description: string }>)[0]
    assert.equal(linea.unit_price, 14044.8)
    assert.equal(linea.subtotal, 14044.8)
    assert.match(linea.description, /x\s0,48\sa\s\$\s29\.260,00\sc\/IVA/)
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
