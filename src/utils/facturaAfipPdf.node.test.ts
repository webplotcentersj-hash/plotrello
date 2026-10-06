import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FacturaVentaRecord } from '../types/api'
import {
  buildAfipQrPayload,
  buildAfipQrUrl,
  buildFacturaAfipPdf,
  formatCuitPdf,
  tipoDocReceptorPdf
} from './facturaAfipPdf.ts'

const facturaA: FacturaVentaRecord = {
  id: 9,
  numero_factura: '0014-00000002',
  punto_venta: 14,
  numero_comprobante: 2,
  tipo_comprobante: 'Factura A',
  fecha_emision: '2026-10-06',
  cliente_nombre: 'Cliente Demo',
  cliente_dni_cuit: '30715518801',
  cliente_condicion_iva: 'Responsable Inscripto',
  subtotal: 100,
  descuento: 0,
  iva: 21,
  total: 121,
  estado: 'Emitida',
  estado_afip: 'Autorizada',
  cae: '86406405514474',
  fecha_vencimiento_cae: '2026-10-16'
}

describe('factura AFIP PDF / QR', () => {
  it('formatea CUIT y detecta documento del receptor', () => {
    assert.equal(formatCuitPdf('30715518801'), '30-71551880-1')
    assert.deepEqual(tipoDocReceptorPdf('30715518801'), { tipoDocRec: 80, nroDocRec: 30715518801 })
    assert.deepEqual(tipoDocReceptorPdf('30123456'), { tipoDocRec: 96, nroDocRec: 30123456 })
    assert.deepEqual(tipoDocReceptorPdf(''), { tipoDocRec: 99, nroDocRec: 0 })
  })

  it('arma el QR de AFIP (RG 4291) con CAE y tipo 1 para Factura A', () => {
    const payload = buildAfipQrPayload(facturaA, '30-71551880-1')
    assert.ok(payload)
    assert.equal(payload.ver, 1)
    assert.equal(payload.tipoCmp, 1)
    assert.equal(payload.ptoVta, 14)
    assert.equal(payload.nroCmp, 2)
    assert.equal(payload.cuit, 30715518801)
    assert.equal(payload.codAut, 86406405514474)
    assert.equal(payload.tipoDocRec, 80)
    assert.equal(payload.moneda, 'PES')
    const url = buildAfipQrUrl(payload)
    assert.match(url, /^https:\/\/www\.afip\.gob\.ar\/fe\/qr\/\?p=/)
    const decoded = JSON.parse(Buffer.from(url.split('p=')[1], 'base64').toString('utf8'))
    assert.equal(decoded.tipoCmp, 1)
    assert.equal(decoded.codAut, 86406405514474)
  })

  it('no arma QR si falta el CAE', () => {
    assert.equal(buildAfipQrPayload({ ...facturaA, cae: null, numero_cae: null }, '30715518801'), null)
  })

  it('genera un PDF valido', async () => {
    const doc = await buildFacturaAfipPdf(
      {
        ...facturaA,
        items: [
          {
            id: 1,
            id_factura: 9,
            item_numero: 1,
            descripcion: 'Impresion gran formato',
            cantidad: 1,
            precio_unitario: 100,
            descuento: 0,
            iva_porcentaje: 21,
            iva_monto: 21,
            subtotal: 100,
            total: 121
          }
        ]
      },
      {
        cuit: '30715518801',
        razon_social: 'PLOT CENTER S.R.L.',
        domicilio_comercial: 'San Juan',
        condicion_iva: 'Responsable Inscripto',
        ingresos_brutos: null,
        fecha_inicio_actividades: '2015-01-01'
      }
    )
    const bytes = doc.output('arraybuffer')
    assert.equal(Buffer.from(bytes.slice(0, 4)).toString(), '%PDF')
    assert.ok(bytes.byteLength > 1000)
  })
})
