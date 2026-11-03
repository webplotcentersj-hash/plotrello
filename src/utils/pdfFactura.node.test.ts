import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FacturaVentaRecord } from '../types/api'
import { obtenerPdfFactura, usaPdfDelSdk } from './pdfFactura.ts'

const base: FacturaVentaRecord = {
  id: 692,
  numero_factura: '0014-00000692',
  punto_venta: 14,
  numero_comprobante: 692,
  tipo_comprobante: 'Factura B',
  fecha_emision: '2026-11-02',
  cliente_nombre: 'Cliente',
  subtotal: 100,
  descuento: 0,
  iva: 21,
  total: 121,
  estado: 'Emitida',
  estado_afip: 'Autorizada',
  cae: '86440688442835'
}

function origenes() {
  const llamadas: string[] = []
  return {
    llamadas,
    sdk: async (id: number) => {
      llamadas.push(`sdk:${id}`)
      return { blob: new Blob(['sdk']), nombre: 'del-sdk.pdf' }
    },
    borrador: async (f: FacturaVentaRecord) => {
      llamadas.push(`borrador:${f.id}`)
      return { blob: new Blob(['borrador']), nombre: 'borrador.pdf' }
    }
  }
}

describe('usaPdfDelSdk', () => {
  it('autorizado con CAE → SDK', () => {
    assert.equal(usaPdfDelSdk(base), true)
    assert.equal(usaPdfDelSdk({ ...base, cae: null, numero_cae: '86440688442835' }), true)
  })

  it('borrador, sin CAE o no autorizado → no', () => {
    assert.equal(usaPdfDelSdk({ ...base, estado_afip: 'Pendiente' }), false)
    assert.equal(usaPdfDelSdk({ ...base, estado_afip: 'Rechazada' }), false)
    assert.equal(usaPdfDelSdk({ ...base, cae: null, numero_cae: null }), false)
    assert.equal(usaPdfDelSdk({ ...base, estado_afip: null }), false)
  })
})

describe('obtenerPdfFactura', () => {
  it('con CAE pide el PDF al SDK con el id de la factura', async () => {
    const o = origenes()
    const pdf = await obtenerPdfFactura(base, o)
    assert.equal(pdf.nombre, 'del-sdk.pdf')
    assert.deepEqual(o.llamadas, ['sdk:692'])
  })

  it('un borrador no consulta al SDK', async () => {
    const o = origenes()
    const pdf = await obtenerPdfFactura({ ...base, estado: 'Borrador', estado_afip: 'Pendiente', cae: null }, o)
    assert.equal(pdf.nombre, 'borrador.pdf')
    assert.deepEqual(o.llamadas, ['borrador:692'])
  })

  it('un error del SDK se propaga (no se reemplaza en silencio por otro PDF)', async () => {
    const o = origenes()
    await assert.rejects(
      obtenerPdfFactura(base, {
        ...o,
        sdk: async () => {
          throw new Error('AfipSDK no respondió')
        }
      }),
      /AfipSDK no respondió/
    )
    assert.deepEqual(o.llamadas, [])
  })
})
