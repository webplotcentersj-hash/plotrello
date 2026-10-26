import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  codigoAlicuota,
  codigoTipoComprobante,
  fmtImporte,
  fmtTexto,
  generarLibroIvaDigital
} from './libroIvaDigital'

const lineas = (txt: string) => txt.split('\r\n').filter(Boolean)

test('formatos básicos', () => {
  assert.equal(fmtImporte(1234.5), '000000000123450')
  assert.equal(fmtImporte(-10), '000000000001000')
  assert.equal(fmtTexto('Ñandú S.A.', 12), 'NANDU S.A.  ')
  assert.equal(codigoAlicuota(21), '0005')
  assert.equal(codigoAlicuota(10.5), '0004')
  assert.equal(codigoAlicuota(13), null)
  assert.equal(codigoTipoComprobante('Factura A'), '001')
  assert.equal(codigoTipoComprobante('Nota de Crédito B'), '008')
  assert.equal(codigoTipoComprobante('Nota de Débito C'), '012')
  assert.equal(codigoTipoComprobante('Factura', 'A'), '001')
  assert.equal(codigoTipoComprobante('Recibo X'), null)
})

test('ventas: largos de registro y alícuotas por comprobante', () => {
  const r = generarLibroIvaDigital(
    [
      {
        tipo_comprobante: 'Factura A',
        punto_venta: 3,
        numero_comprobante: 15,
        fecha_emision: '2026-10-05',
        cliente_nombre: 'Cliente Ñoño SRL',
        cliente_dni_cuit: '30-71234567-8',
        total: 1815,
        cae: '123',
        items: [
          { iva_porcentaje: 21, subtotal: 1000, iva_monto: 210 },
          { iva_porcentaje: 10.5, subtotal: 500, iva_monto: 52.5 },
          { iva_porcentaje: 0, subtotal: 52.5, iva_monto: 0 }
        ]
      }
    ],
    []
  )
  const cab = lineas(r.ventasCbte)
  const ali = lineas(r.ventasAlicuotas)
  assert.equal(cab.length, 1)
  assert.equal(cab[0].length, 266)
  assert.equal(ali.length, 3)
  for (const l of ali) assert.equal(l.length, 62)
  assert.equal(cab[0].slice(0, 8), '20261005')
  assert.equal(cab[0].slice(8, 11), '001')
  assert.equal(cab[0].slice(11, 16), '00003')
  assert.equal(cab[0].slice(56, 58), '80')
  assert.equal(cab[0].slice(58, 78), '30712345678'.padStart(20, '0'))
  assert.equal(cab[0].includes('CLIENTE NONO SRL'), true)
  // cantidad de alícuotas y código de operación
  assert.equal(cab[0].slice(241, 242), '3')
  assert.equal(cab[0].slice(242, 243), '0')
  assert.equal(r.resumen.ventas.iva, 262.5)
  assert.deepEqual(r.warnings, [])
})

test('ventas: nota de crédito con importes negativos sale positiva', () => {
  const r = generarLibroIvaDigital(
    [
      {
        tipo_comprobante: 'Nota de Crédito A',
        punto_venta: 1,
        numero_comprobante: 2,
        fecha_emision: '2026-10-06',
        cliente_nombre: 'X',
        cliente_dni_cuit: '20111111112',
        total: -121,
        cae: '9',
        items: [{ iva_porcentaje: 21, subtotal: -100, iva_monto: -21 }]
      }
    ],
    []
  )
  const cab = lineas(r.ventasCbte)[0]
  assert.equal(cab.slice(8, 11), '003')
  assert.equal(cab.slice(108, 123), '000000000012100')
  assert.equal(r.resumen.ventas.total, 121)
})

test('compras: factura A discrimina IVA y percepciones suman al total', () => {
  const r = generarLibroIvaDigital(
    [],
    [
      {
        tipo_comprobante: 'Factura',
        letra: 'A',
        punto_venta: 12,
        numero_comprobante: 345,
        fecha_emision: '2026-10-10',
        proveedor_nombre: 'Proveedor SA',
        proveedor_cuit: '30-50000000-1',
        subtotal: 1000,
        iva: 210,
        percepcion_iibb: 30,
        total: 1240,
        items: [{ iva_porcentaje: 21, subtotal: 1000, iva_monto: 210 }]
      }
    ]
  )
  const cab = lineas(r.comprasCbte)
  const ali = lineas(r.comprasAlicuotas)
  assert.equal(cab.length, 1)
  assert.equal(cab[0].length, 325)
  assert.equal(ali.length, 1)
  assert.equal(ali[0].length, 84)
  assert.deepEqual(r.warnings, [])
  assert.equal(r.resumen.compras.iva, 210)
})

test('compras: factura B no genera alícuotas y va como no gravado', () => {
  const r = generarLibroIvaDigital(
    [],
    [
      {
        tipo_comprobante: 'Factura',
        letra: 'B',
        punto_venta: 1,
        numero_comprobante: 9,
        fecha_emision: '2026-10-11',
        proveedor_nombre: 'Kiosco',
        proveedor_cuit: '20-30000000-4',
        subtotal: 100,
        iva: 21,
        total: 121,
        items: [{ iva_porcentaje: 21, subtotal: 100, iva_monto: 21 }]
      }
    ]
  )
  assert.equal(lineas(r.comprasAlicuotas).length, 0)
  const cab = lineas(r.comprasCbte)[0]
  assert.equal(cab.length, 325)
  assert.equal(cab.slice(8, 11), '006')
  assert.deepEqual(r.warnings, [])
})

test('avisos: CUIT inválido y tipo desconocido', () => {
  const r = generarLibroIvaDigital(
    [{ tipo_comprobante: 'Recibo', punto_venta: 1, numero_comprobante: 1, total: 10 }],
    [
      {
        tipo_comprobante: 'Factura',
        letra: 'A',
        punto_venta: 1,
        numero_comprobante: 1,
        fecha_emision: '2026-10-01',
        proveedor_nombre: 'X',
        proveedor_cuit: '123',
        subtotal: 100,
        iva: 21,
        total: 121,
        items: [{ iva_porcentaje: 21, subtotal: 100, iva_monto: 21 }]
      }
    ]
  )
  assert.equal(r.warnings.length, 2)
  assert.equal(lineas(r.ventasCbte).length, 0)
  // sin CUIT válido el vendedor queda como "sin identificar"
  assert.equal(lineas(r.comprasCbte)[0].slice(52, 54), '99')
})
