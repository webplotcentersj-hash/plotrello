import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  casosFactura,
  emisorPlot,
  factura692,
  facturaA,
  facturaC,
  notaCreditoB,
  referenciaFactura692
} from './fixturasFactura.ts'
import { calcularImportesAfip } from './mapFactura.ts'
import { buildAfipHtmlPdfRequest, datosFactura, htmlFactura, urlQrAfip } from './pdfHtml.ts'

const QR_FALSO = 'data:image/png;base64,QR'

/** Texto visible del HTML (sin estilos ni etiquetas) para poder comparar lo que se imprime. */
function texto(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const pagina = (f: Parameters<typeof datosFactura>[0], ref = null as Parameters<typeof datosFactura>[2]) =>
  texto(htmlFactura(datosFactura(f, emisorPlot, ref), QR_FALSO))

function assertContiene(t: string, esperados: string[]) {
  for (const e of esperados) assert.ok(t.includes(e), `falta "${e}" en: ${t.slice(0, 500)}…`)
}

describe('lo que se imprime coincide con lo informado a ARCA', () => {
  for (const [nombre, factura] of casosFactura) {
    it(nombre, () => {
      const importes = calcularImportesAfip(factura)
      const d = datosFactura(factura, emisorPlot)
      assert.equal(d.total, importes.total, 'total')
      assert.equal(d.iva, importes.iva, 'IVA')
      assert.equal(d.neto, importes.neto, 'neto')
      if (d.letra !== 'C') {
        // ARCA recibe las alícuotas en el orden de aparición; el comprobante las imprime de menor a mayor.
        const porMonto = (a: { base: number; iva: number }, b: { base: number; iva: number }) =>
          a.base - b.base || a.iva - b.iva
        assert.deepEqual(
          d.alicuotas.map((a) => ({ base: a.neto, iva: a.iva })).sort(porMonto),
          importes.alicuotas.map((a) => ({ base: a.BaseImp, iva: a.Importe })).sort(porMonto),
          'desglose por alícuota'
        )
      }
      const sumaLineas = Math.round(d.lineas.reduce((s, l) => s + (d.letra === 'A' ? l.neto : l.total), 0) * 100) / 100
      assert.equal(sumaLineas, d.letra === 'A' ? importes.neto : importes.total, 'suma de las líneas')
      assert.ok(d.total > 0 && d.iva >= 0 && d.neto > 0, 'importes siempre en positivo')
    })
  }
})

describe('Factura B (la 692)', () => {
  const t = pagina(factura692)

  it('muestra el precio por m² con IVA y la cantidad real, sin trucos en la descripción', () => {
    assertContiene(t, ['VINILO IMPRESO + PRE CORTE X M2 (m²)', '0,48', '$ 29.260,00', '$ 14.044,80'])
    assert.ok(!/x\s0,48\sa/.test(t), 'la cantidad no va pegada a la descripción')
  })

  it('lleva la leyenda de transparencia fiscal con el IVA contenido', () => {
    assertContiene(t, [
      'Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)',
      'IVA Contenido: $ 2.437,53',
      'Otros Impuestos Nacionales Indirectos: $ 0,00'
    ])
  })

  it('datos del comprobante, receptor y autorización', () => {
    assertContiene(t, [
      'FACTURA',
      'COD. 006',
      'Punto de Venta: 0014 Comp. Nro: 00000692',
      'Fecha de Emisión: 02/11/2026',
      'CUIT: 30-71551880-1',
      'Condición de venta: Contado',
      'DNI: 20942051',
      'CAE N°: 86440688442835',
      'Fecha de Vto. de CAE: 12/11/2026'
    ])
  })

  it('sin marca de terceros, con logo y QR embebidos', () => {
    const html = htmlFactura(datosFactura(factura692, emisorPlot), QR_FALSO)
    assert.ok(!/afip sdk/i.test(t))
    assert.ok(html.includes('data:image/png;base64,iVBOR'), 'logo embebido')
    assert.ok(html.includes(QR_FALSO), 'QR embebido')
  })
})

describe('Factura A y Factura C', () => {
  it('la A discrimina el IVA por alícuota y no lleva la leyenda de transparencia', () => {
    const t = pagina(facturaA)
    assertContiene(t, [
      'COD. 001',
      'Alíc. IVA',
      'Subtotal c/IVA',
      'Importe Neto Gravado $ 1.550,00',
      'IVA 0% $ 0,00',
      'IVA 10,5% $ 42,00',
      'IVA 21% $ 210,00',
      'Importe Total $ 1.802,00'
    ])
    assert.ok(!t.includes('Transparencia'))
  })

  it('en la A el precio unitario es el neto guardado', () => {
    assert.equal(datosFactura(facturaA, emisorPlot).lineas[1].unitario, 160)
  })

  it('la C no discrimina IVA ni lleva leyenda', () => {
    const t = pagina(facturaC)
    assertContiene(t, ['COD. 011', 'Subtotal $ 2.000,00', 'Importe Total $ 2.000,00'])
    assert.ok(!t.includes('Alíc. IVA') && !t.includes('Transparencia') && !t.includes('IVA 0%'))
  })
})

describe('notas, servicios y datos no confiables', () => {
  it('una nota de crédito guardada en negativo se imprime en positivo, con su comprobante asociado', () => {
    const t = pagina(notaCreditoB, referenciaFactura692)
    assertContiene(t, [
      'NOTA DE CRÉDITO',
      'COD. 008',
      'Comprobante asociado: Factura B 0014-00000692 (02/11/2026)',
      'Importe Total $ 14.044,80',
      'IVA Contenido: $ 2.437,53'
    ])
    assert.ok(!/-\s?\$|\$\s?-|-14\.044/.test(t), 'no debe haber importes negativos')
  })

  it('servicios: período facturado, vencimiento de pago y cuenta corriente', () => {
    const t = pagina({
      ...factura692,
      concepto: 2,
      fecha_servicio_desde: '2026-10-01',
      fecha_servicio_hasta: '2026-10-31',
      fecha_vencimiento: '2026-11-30'
    })
    assertContiene(t, [
      'Concepto: Servicios',
      'Período facturado: 01/10/2026 al 31/10/2026',
      'Vto. de pago: 30/11/2026',
      'Condición de venta: Cuenta corriente (vence 30/11/2026)'
    ])
  })

  it('los datos del cliente no pueden inyectar HTML', () => {
    const maligno = '<script>alert(1)</script> & "x"'
    const html = htmlFactura(
      datosFactura({ ...factura692, cliente_nombre: maligno, observaciones: '<img src=x onerror=alert(1)>' }, emisorPlot),
      QR_FALSO
    )
    assert.ok(!html.includes('<script>'), 'sin <script> crudo')
    assert.ok(!html.includes('<img src=x'), 'sin <img> inyectado')
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;'))
  })

  it('sin CAE no se genera: el PDF es posterior a la autorización', () => {
    assert.throws(() => datosFactura({ ...factura692, cae: null, numero_cae: null }, emisorPlot), /no tiene CAE/)
  })
})

describe('QR y pedido al SDK', () => {
  const payload = (f: Parameters<typeof urlQrAfip>[0]) =>
    JSON.parse(Buffer.from(urlQrAfip(f, emisorPlot).split('?p=')[1], 'base64').toString('utf8'))

  it('el QR lleva los datos del comprobante, con el importe siempre en positivo', () => {
    assert.deepEqual(payload(factura692), {
      ver: 1,
      fecha: '2026-11-02',
      cuit: 30715518801,
      ptoVta: 14,
      tipoCmp: 6,
      nroCmp: 692,
      importe: 14044.8,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 96,
      nroDocRec: 20942051,
      tipoCodAut: 'E',
      codAut: 86440688442835
    })
    const nc = payload(notaCreditoB)
    assert.equal(nc.importe, 14044.8)
    assert.equal(nc.tipoCmp, 8)
  })

  it('arma el pedido con nombre de archivo, HTML y ancho A4', async () => {
    const pedido = await buildAfipHtmlPdfRequest(factura692, emisorPlot)
    assert.equal(pedido.file_name, 'Factura_B_0014-00000692.pdf')
    assert.equal(pedido.options.width, 8.27)
    assert.ok(pedido.html.startsWith('<!doctype html>'))
    assert.match(pedido.html, /<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="QR de ARCA">/)
  })
})
