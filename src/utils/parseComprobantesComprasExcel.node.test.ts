import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  gastoImportKey,
  parseComprobantesComprasAoa,
  parseTipoComprobanteAfip,
  payloadGastoDesdeExcel
} from './parseComprobantesComprasExcel.ts'

const HEADER = [
  'Fecha',
  'Tipo',
  'Punto de Venta',
  'Número Desde',
  'Número Hasta',
  'Tipo Doc. Vendedor',
  'Nro. Doc. Vendedor',
  'Denominación Vendedor',
  'Tipo Cambio',
  'Moneda',
  'Neto Gravado',
  'No Gravado',
  'Exento',
  'IVA',
  'Total'
]

describe('parseTipoComprobanteAfip', () => {
  it('parte Factura A', () => {
    const t = parseTipoComprobanteAfip('1 - Factura A')
    assert.equal(t.tipo, 'Factura')
    assert.equal(t.letra, 'A')
    assert.equal(t.esNc, false)
  })
  it('parte Nota de Crédito B', () => {
    const t = parseTipoComprobanteAfip('8 - Nota de Crédito B')
    assert.equal(t.tipo, 'Nota de Crédito')
    assert.equal(t.letra, 'B')
    assert.equal(t.esNc, true)
  })
})

describe('parseComprobantesComprasAoa', () => {
  it('lee el Excel de Comprobantes de Compras AFIP', () => {
    const parsed = parseComprobantesComprasAoa([
      ['Comprobantes de Compras - CUIT 30715518001'],
      HEADER,
      ['01/08/2026', '1 - Factura A', 1, 4048, 4048, 'CUIT', '30716891007', 'SAN SISTEMAS S. R. L.', 1, '$', 37190.08, 0, 0, 7809.92, 45000],
      ['01/08/2026', '1 - Factura A', 36, 536555230, 536555230, 'CUIT', '30716857606', 'DELIVERY HERO E-COMMERCE S.A.', 1, '$', 0, 0, 0, 0, 3919],
      ['02/08/2026', '1 - Factura A', 13, 44893, 44893, 'CUIT', '33716202008', 'ESTACION CENTRAL S.A.S.', 1, '$', 73318.55, 0, 0, 15396.9, 99999.91],
      ['02/08/2026', '1 - Factura B', 12, 43190, 43190, 'CUIT', '33716202008', 'ESTACION CENTRAL S.A.S.', 1, '$', 73318.55, 0, 0, 15396.9, 99999.91]
    ])
    assert.equal(parsed.rows.length, 4)
    assert.match(String(parsed.titulo), /Comprobantes de Compras/)
    const san = parsed.rows[0]
    assert.equal(san.fecha, '2026-08-01')
    assert.equal(san.proveedor, 'SAN SISTEMAS S. R. L.')
    assert.equal(san.proveedor_cuit, '30716891007')
    assert.equal(san.punto_venta, 1)
    assert.equal(san.numero, 4048)
    assert.equal(san.letra, 'A')
    assert.equal(san.total, 45000)
    assert.equal(san.iva, 7809.92)
    assert.equal(san.numero_comprobante, '0001-00004048')
    const b = parsed.rows[3]
    assert.equal(b.letra, 'B')
    assert.equal(b.tipo_comprobante, 'Factura')
  })

  it('acepta números argentinos con coma', () => {
    const parsed = parseComprobantesComprasAoa([
      HEADER,
      ['03/08/2026', '1 - Factura A', 0, 2930, 2930, 'CUIT', '30710244673', 'WAYPOINT SRL', 1, '$', '599,79', '0,00', '0,00', '0,00', '2529,00']
    ])
    assert.equal(parsed.rows.length, 1)
    assert.equal(parsed.rows[0].total, 2529)
    assert.equal(parsed.rows[0].neto_gravado, 599.79)
  })
})

describe('payloadGastoDesdeExcel', () => {
  it('arma el gasto y deja NC en negativo', () => {
    const parsed = parseComprobantesComprasAoa([
      HEADER,
      ['01/08/2026', '1 - Factura A', 1, 4048, 4048, 'CUIT', '30716891007', 'SAN SISTEMAS S. R. L.', 1, '$', 37190.08, 0, 0, 7809.92, 45000],
      ['05/08/2026', '3 - Nota de Crédito A', 1, 10, 10, 'CUIT', '30716891007', 'SAN SISTEMAS S. R. L.', 1, '$', 100, 0, 0, 21, 121]
    ])
    const fac = payloadGastoDesdeExcel(parsed.rows[0])
    assert.equal(fac.total, 45000)
    assert.equal(fac.origen, 'excel_afip')
    assert.equal(fac.categoria, 'Compras AFIP')
    const nc = payloadGastoDesdeExcel(parsed.rows[1])
    assert.equal(nc.total, -121)
    assert.equal(nc.iva, -21)
    assert.equal(nc.tipo_comprobante, 'Nota de Crédito')
    assert.equal(gastoImportKey(parsed.rows[0]), '2026-08-01|30716891007|1|4048|A')
  })
})
