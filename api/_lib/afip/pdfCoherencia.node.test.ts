import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { casosFactura, emisorPlot } from './fixturasFactura.ts'
import { calcularImportesAfip } from './mapFactura.ts'
import { buildAfipSdkPdfRequest } from './pdf.ts'

/**
 * Red de seguridad: lo que muestra el PDF del SDK tiene que coincidir con lo que se informó a ARCA.
 * Mientras estos tests pasen, se puede cambiar el diseño o la forma de mostrar el IVA sin tocar la emisión.
 */
describe('el PDF del SDK muestra lo mismo que se informó a ARCA', () => {
  for (const [nombre, factura] of casosFactura) {
    it(nombre, () => {
      const importes = calcularImportesAfip(factura)
      const params = buildAfipSdkPdfRequest(factura, emisorPlot, null).template.params
      const letra = factura.tipo_comprobante.slice(-1)

      assert.equal(params.total_amount, importes.total, 'importe total')
      assert.equal(params.vat_amount, importes.iva, 'importe de IVA')
      assert.equal(params.net_amount_taxed, importes.neto, 'neto gravado')

      // Lo impreso en las líneas suma lo mismo: neto en la A, importe final en la B y la C.
      const lineas = params.items as Array<{ subtotal: number }>
      const sumaLineas = Math.round(lineas.reduce((s, l) => s + l.subtotal, 0) * 100) / 100
      assert.equal(sumaLineas, letra === 'A' ? importes.neto : importes.total, 'suma de las líneas')

      if (letra !== 'C') {
        const desglose = (params.vat_breakdown as Array<{ vat_rate_id: number; taxable_base: number; vat_subtotal: number }>)
          .map((d) => ({ id: d.vat_rate_id, base: d.taxable_base, iva: d.vat_subtotal }))
          .sort((a, b) => a.id - b.id)
        const enviado = importes.alicuotas
          .map((a) => ({ id: a.Id, base: a.BaseImp, iva: a.Importe }))
          .sort((a, b) => a.id - b.id)
        assert.deepEqual(desglose, enviado, 'desglose de IVA por alícuota')
      }
    })
  }
})
