import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildWsfeVoucherData, calcularImportesAfip, FacturaInvalidaError, parseDoc } from './mapFactura.ts'
import type { FacturaAfipInput } from './types.ts'

function factura(overrides: Partial<FacturaAfipInput> = {}): FacturaAfipInput {
  return {
    id: 1,
    tipo_comprobante: 'Factura B',
    punto_venta: 1,
    numero_comprobante: 0,
    fecha_emision: '2026-09-22',
    cliente_nombre: 'Cliente',
    cliente_dni_cuit: null,
    cliente_condicion_iva: 'Consumidor Final',
    subtotal: 21,
    iva: 4.42,
    total: 25.42,
    items: [
      { iva_porcentaje: 21, subtotal: 10.5, iva_monto: 2.21, total: 12.71 },
      { iva_porcentaje: 21, subtotal: 10.5, iva_monto: 2.21, total: 12.71 }
    ],
    ...overrides
  }
}

const params = { puntoVenta: 1, numeroComprobante: 5, fechaEmision: '2026-09-22', condicionEmisor: 'Responsable Inscripto' }

describe('importes AFIP', () => {
  it('ImpIVA = suma de alícuotas e ImpTotal = ImpNeto + ImpIVA', () => {
    const data = buildWsfeVoucherData(factura(), params)
    const iva = data.Iva as Array<{ Id: number; BaseImp: number; Importe: number }>
    assert.deepEqual(iva, [{ Id: 5, BaseImp: 21, Importe: 4.42 }])
    assert.equal(data.ImpIVA, 4.42)
    assert.equal(data.ImpNeto, 21)
    assert.equal(data.ImpTotal, 25.42)
  })

  it('ajusta la diferencia de redondeo de comprobantes viejos (1 centavo) a lo que suman los ítems', () => {
    const imp = calcularImportesAfip(factura({ iva: 4.41, total: 25.41 }))
    assert.equal(imp.total, 25.42)
  })

  it('rechaza totales que no cierran con los ítems', () => {
    assert.throws(() => calcularImportesAfip(factura({ total: 30 })), FacturaInvalidaError)
  })

  it('agrupa alícuotas distintas y respeta 0%', () => {
    const imp = calcularImportesAfip(
      factura({
        subtotal: 200,
        iva: 10.5,
        total: 210.5,
        items: [
          { iva_porcentaje: 10.5, subtotal: 100, iva_monto: 10.5, total: 110.5 },
          { iva_porcentaje: 0, subtotal: 100, iva_monto: 0, total: 100 }
        ]
      })
    )
    assert.deepEqual(imp.alicuotas, [
      { Id: 4, BaseImp: 100, Importe: 10.5 },
      { Id: 3, BaseImp: 100, Importe: 0 }
    ])
  })

  it('Factura C: neto = total, sin array de IVA', () => {
    const data = buildWsfeVoucherData(
      factura({ tipo_comprobante: 'Factura C', subtotal: 1000, iva: 0, total: 1000, items: [{ iva_porcentaje: 0, subtotal: 1000, iva_monto: 0, total: 1000 }] }),
      { ...params, condicionEmisor: 'Monotributista' }
    )
    assert.equal(data.ImpNeto, 1000)
    assert.equal(data.ImpIVA, 0)
    assert.equal(data.Iva, undefined)
  })
})

describe('concepto', () => {
  it('productos no informa fechas de servicio', () => {
    const data = buildWsfeVoucherData(factura(), params)
    assert.equal(data.Concepto, 1)
    assert.equal(data.FchServDesde, undefined)
    assert.equal(data.FchVtoPago, undefined)
  })

  it('servicios informa período y vencimiento del pago', () => {
    const data = buildWsfeVoucherData(
      factura({ concepto: 2, fecha_servicio_desde: '2026-09-01', fecha_servicio_hasta: '2026-09-30', fecha_vencimiento: '2026-10-10' }),
      params
    )
    assert.equal(data.Concepto, 2)
    assert.equal(data.FchServDesde, '20260901')
    assert.equal(data.FchServHasta, '20260930')
    assert.equal(data.FchVtoPago, '20261010')
  })

  it('productos y servicios sin período usa la fecha del comprobante', () => {
    const data = buildWsfeVoucherData(factura({ concepto: 3 }), params)
    assert.equal(data.FchServDesde, '20260922')
    assert.equal(data.FchServHasta, '20260922')
    assert.equal(data.FchVtoPago, '20260922')
  })
})

describe('receptor y letra', () => {
  it('informa el DNI del consumidor final', () => {
    assert.deepEqual(parseDoc('30.111.222', 'B'), { DocTipo: 96, DocNro: 30111222 })
    assert.deepEqual(parseDoc('', 'B'), { DocTipo: 99, DocNro: 0 })
    assert.deepEqual(parseDoc('20-40937847-2', 'B'), { DocTipo: 80, DocNro: 20409378472 })
  })

  it('Factura A exige CUIT válido', () => {
    assert.throws(() => parseDoc('20409378473', 'A'), FacturaInvalidaError)
  })

  it('emisor RI no puede emitir C y la B no va a un RI', () => {
    assert.throws(() => buildWsfeVoucherData(factura({ tipo_comprobante: 'Factura C' }), params), /no puede emitir comprobantes C/)
    assert.throws(
      () => buildWsfeVoucherData(factura({ cliente_condicion_iva: 'Responsable Inscripto', cliente_dni_cuit: '20409378472' }), params),
      /corresponde comprobante A/
    )
  })

  it('la nota de crédito necesita el comprobante asociado', () => {
    assert.throws(() => buildWsfeVoucherData(factura({ tipo_comprobante: 'Nota de Crédito B' }), params), /referenciar/)
    const data = buildWsfeVoucherData(factura({ tipo_comprobante: 'Nota de Crédito B' }), {
      ...params,
      referencia: { tipo_comprobante: 'Factura B', punto_venta: 1, numero_comprobante: 4 }
    })
    assert.deepEqual(data.CbtesAsoc, [{ Tipo: 6, PtoVta: 1, Nro: 4 }])
    assert.equal(data.CbteTipo, 8)
  })
})
