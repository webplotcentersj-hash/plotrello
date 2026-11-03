import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { FacturaItemRecord } from '../types/api'
import {
  buildAfipQrPayload,
  buildFacturaAfipPdf,
  condicionVentaTexto,
  lineasPdf,
  resumenImportesPdf,
  type FacturaPdf
} from './facturaAfipPdf.ts'

const LOGO = `data:image/png;base64,${readFileSync(new URL('../../public/factura/plot-center-pc.png', import.meta.url)).toString('base64')}`

const emisorPlot = {
  cuit: '30715518801',
  razon_social: 'PLOT CENTER SRL',
  domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
  condicion_iva: 'Responsable Inscripto',
  ingresos_brutos: '30-71551880-1',
  fecha_inicio_actividades: '2017-01-27'
}

const itemM2: FacturaItemRecord = {
  id: 1,
  id_factura: 692,
  item_numero: 1,
  descripcion: 'VINILO IMPRESO + PRE CORTE X M2 (m2)',
  cantidad: 0.48,
  precio_unitario: 29260,
  descuento: 0,
  iva_porcentaje: 21,
  iva_monto: 2437.53,
  subtotal: 11607.27,
  total: 14044.8
}

// La factura B 0014-00000692 emitida con el SDK: 0,48 m² a $ 29.260 el m² (IVA incluido).
const facturaB692: FacturaPdf = {
  id: 692,
  numero_factura: '0014-00000692',
  punto_venta: 14,
  numero_comprobante: 692,
  tipo_comprobante: 'Factura B',
  fecha_emision: '2026-11-02',
  cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
  cliente_dni_cuit: '20942051',
  cliente_condicion_iva: 'Consumidor Final',
  concepto: 1,
  subtotal: 11607.27,
  descuento: 0,
  iva: 2437.53,
  total: 14044.8,
  estado: 'Emitida',
  estado_afip: 'Autorizada',
  cae: '86440688442835',
  fecha_vencimiento_cae: '2026-11-12',
  items: [itemM2]
}

const itemsA: FacturaItemRecord[] = [
  { ...itemM2, id: 1, item_numero: 1, cantidad: 10, subtotal: 1000, iva_monto: 210, total: 1210, iva_porcentaje: 21 },
  { ...itemM2, id: 2, item_numero: 2, cantidad: 2, subtotal: 400, iva_monto: 42, total: 442, iva_porcentaje: 10.5 }
]
const facturaA: FacturaPdf = {
  ...facturaB692,
  tipo_comprobante: 'Factura A',
  cliente_dni_cuit: '30715518801',
  cliente_condicion_iva: 'Responsable Inscripto',
  items: itemsA,
  subtotal: 1400,
  iva: 252,
  total: 1652
}

async function leerPdf(doc: Awaited<ReturnType<typeof buildFacturaAfipPdf>>) {
  const ruta = 'pdfjs-dist/legacy/build/pdf.mjs' // import dinámico: la ruta legacy no trae tipos
  const pdfjs = await import(ruta)
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(doc.output('arraybuffer')), useSystemFonts: true, verbosity: 0 }).promise
  let texto = ''
  let imagenes = 0
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n)
    const contenido = await pagina.getTextContent()
    texto += ' ' + contenido.items.map((i: { str: string }) => i.str).join(' ')
    const ops = await pagina.getOperatorList()
    imagenes += ops.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject).length
  }
  return { texto: texto.replace(/\s+/g, ' ').trim(), imagenes, paginas: pdf.numPages as number }
}

function assertContiene(texto: string, esperados: string[]) {
  for (const e of esperados) assert.ok(texto.includes(e), `falta "${e}" en: ${texto.slice(0, 400)}…`)
}

describe('PDF propio: importes', () => {
  it('Factura B: precio final por m² e IVA contenido', () => {
    const [l] = lineasPdf(facturaB692.items, 'B')
    assert.equal(l.cantidad, 0.48)
    assert.equal(l.unitario, 29260)
    const r = resumenImportesPdf(facturaB692, 'B')
    assert.equal(r.total, 14044.8)
    assert.equal(r.ivaContenido, 2437.53)
  })

  it('Factura A: neto unitario y totales por alícuota, de menor a mayor', () => {
    assert.deepEqual(lineasPdf(itemsA, 'A').map((l) => l.unitario), [100, 200])
    const r = resumenImportesPdf(facturaA, 'A')
    assert.deepEqual(r.alicuotas, [
      { alicuota: 10.5, neto: 400, iva: 42 },
      { alicuota: 21, neto: 1000, iva: 210 }
    ])
    assert.equal(r.neto, 1400)
    assert.equal(r.iva, 252)
    assert.equal(r.total, 1652)
    assert.equal(r.ivaContenido, 0)
  })

  it('Factura C: sin IVA ni leyenda', () => {
    const c: FacturaPdf = {
      ...facturaB692,
      tipo_comprobante: 'Factura C',
      items: [{ ...itemM2, iva_monto: 0, subtotal: 100, total: 100 }],
      total: 100
    }
    const r = resumenImportesPdf(c, 'C')
    assert.equal(r.iva, 0)
    assert.deepEqual(r.alicuotas.map((a) => a.alicuota), [0])
    assert.equal(r.ivaContenido, 0)
  })

  it('sin ítems usa los totales de la factura y asume 21 %', () => {
    const r = resumenImportesPdf({ ...facturaA, items: [] }, 'A')
    assert.deepEqual(r.alicuotas, [{ alicuota: 21, neto: 1400, iva: 252 }])
  })
})

describe('condicionVentaTexto', () => {
  it('Contado por defecto, cuenta corriente si el pago vence después de la emisión', () => {
    assert.equal(condicionVentaTexto(facturaB692), 'Contado')
    assert.equal(condicionVentaTexto({ ...facturaB692, fecha_vencimiento: '2026-11-02' }), 'Contado')
    assert.equal(
      condicionVentaTexto({ ...facturaB692, fecha_vencimiento: '2026-11-30' }),
      'Cuenta corriente (vence 30/11/2026)'
    )
  })

  it('respeta la condición indicada', () => {
    assert.equal(condicionVentaTexto({ ...facturaB692, condicion_venta: ' Transferencia ' }), 'Transferencia')
  })
})

describe('PDF propio: contenido', () => {
  it('Factura B: logo, QR, leyenda de transparencia fiscal y datos del comprobante', async () => {
    const { texto, imagenes } = await leerPdf(await buildFacturaAfipPdf(facturaB692, emisorPlot, { logoDataUrl: LOGO }))
    assert.equal(imagenes, 2, 'logo + QR')
    assertContiene(texto, [
      'FACTURA',
      'COD. 006',
      'Punto de Venta: 0014',
      'Comp. Nro: 00000692',
      'Fecha de Emisión: 02/11/2026',
      'Condición de venta: Contado',
      'DNI: 20942051',
      '0,48',
      '$ 29.260,00',
      '$ 14.044,80',
      'Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)',
      'IVA Contenido: $ 2.437,53',
      'Otros Impuestos Nacionales Indirectos: $ 0,00',
      'CAE N°: 86440688442835',
      'Fecha de Vto. de CAE: 12/11/2026'
    ])
    assert.ok(!texto.includes('Afip SDK'))
  })

  it('sin logo solo queda el QR', async () => {
    const { imagenes } = await leerPdf(await buildFacturaAfipPdf(facturaB692, emisorPlot, { logoDataUrl: null }))
    assert.equal(imagenes, 1)
  })

  it('Factura A discrimina el IVA y no lleva la leyenda de transparencia', async () => {
    const { texto } = await leerPdf(await buildFacturaAfipPdf(facturaA, emisorPlot, { logoDataUrl: null }))
    assertContiene(texto, [
      'COD. 001',
      'CUIT: 30-71551880-1',
      'Importe Neto Gravado',
      '$ 1.400,00',
      'IVA 10,5%',
      '$ 42,00',
      'IVA 21%',
      '$ 210,00',
      '$ 1.652,00'
    ])
    assert.ok(!texto.includes('Transparencia'))
  })

  it('nota de crédito muestra el comprobante asociado', async () => {
    const nota: FacturaPdf = {
      ...facturaB692,
      tipo_comprobante: 'Nota de Crédito B',
      numero_factura: '0014-00000023',
      numero_comprobante: 23
    }
    const { texto } = await leerPdf(
      await buildFacturaAfipPdf(nota, emisorPlot, {
        logoDataUrl: null,
        referencia: { tipo_comprobante: 'Factura B', numero_factura: '0014-00000692', fecha_emision: '2026-11-02' }
      })
    )
    assertContiene(texto, ['NOTA DE CRÉDITO', 'COD. 008', 'Comprobante asociado: Factura B 0014-00000692 (02/11/2026)'])
  })

  it('servicios: período facturado y vencimiento de pago', async () => {
    const servicio: FacturaPdf = {
      ...facturaB692,
      concepto: 2,
      fecha_servicio_desde: '2026-10-01',
      fecha_servicio_hasta: '2026-10-31',
      fecha_vencimiento: '2026-11-30'
    }
    const { texto } = await leerPdf(await buildFacturaAfipPdf(servicio, emisorPlot, { logoDataUrl: null }))
    assertContiene(texto, [
      'Período facturado: 01/10/2026 al 31/10/2026',
      'Vto. de pago: 30/11/2026',
      'Cuenta corriente (vence 30/11/2026)'
    ])
  })

  it('borrador: sin QR y marcado como no válido', async () => {
    const borrador: FacturaPdf = { ...facturaB692, estado: 'Borrador', estado_afip: 'Pendiente', cae: null }
    const { texto, imagenes } = await leerPdf(await buildFacturaAfipPdf(borrador, emisorPlot, { logoDataUrl: null }))
    assert.equal(imagenes, 0)
    assertContiene(texto, ['BORRADOR', 'No válido como factura'])
  })

  it('varias páginas: encabezado y pie en cada una, el QR solo al final', async () => {
    const muchos: FacturaItemRecord[] = Array.from({ length: 45 }, (_, i) => ({
      ...itemM2,
      id: i + 1,
      item_numero: i + 1,
      descripcion: `ITEM ${i + 1} VINILO IMPRESO Y LAMINADO CON TERMINACION ESPECIAL (m2)`,
      cantidad: 1,
      subtotal: 1000,
      iva_monto: 210,
      total: 1210
    }))
    const f: FacturaPdf = { ...facturaA, items: muchos, subtotal: 45000, iva: 9450, total: 54450 }
    const { texto, paginas, imagenes } = await leerPdf(await buildFacturaAfipPdf(f, emisorPlot, { logoDataUrl: LOGO }))
    assert.ok(paginas >= 2, `esperaba varias páginas y hubo ${paginas}`)
    assert.equal(imagenes, paginas + 1, 'un logo por página y un solo QR')
    assertContiene(texto, ['Continuación', `Página 1/${paginas}`, `Página ${paginas}/${paginas}`, '$ 54.450,00'])
  })
})

// Así se guardan los ítems en la base: precio unitario NETO de IVA aunque se haya cargado con IVA incluido,
// y las notas de crédito con subtotal, IVA y total en negativo.
const itemGuardado: FacturaItemRecord = { ...itemM2, precio_unitario: 24181.82 }

describe('PDF propio: datos como los guarda la app', () => {
  it('Factura B: el precio final sale de la línea, no del precio neto guardado', () => {
    const [l] = lineasPdf([itemGuardado], 'B')
    assert.equal(l.unitario, 29260)
  })

  it('Factura A: usa el precio neto guardado cuando cierra con el subtotal', () => {
    const [l] = lineasPdf([itemGuardado], 'A')
    assert.equal(l.unitario, 24181.82)
  })

  it('Factura A: con descuento aparte, deriva el neto unitario del subtotal', () => {
    const [l] = lineasPdf([{ ...itemGuardado, descuento: 500, subtotal: 11107.27, iva_monto: 2332.53, total: 13439.8 }], 'A')
    assert.equal(l.unitario, 23140.15)
  })

  it('nota de crédito: importes en positivo en el PDF y en el QR', async () => {
    const itemNegativo: FacturaItemRecord = { ...itemGuardado, descuento: 0, iva_monto: -2437.53, subtotal: -11607.27, total: -14044.8 }
    const nota: FacturaPdf = {
      ...facturaB692,
      tipo_comprobante: 'Nota de Crédito B',
      numero_factura: '0014-00000023',
      numero_comprobante: 23,
      subtotal: -11607.27,
      iva: -2437.53,
      total: -14044.8,
      items: [itemNegativo]
    }
    const { texto } = await leerPdf(await buildFacturaAfipPdf(nota, emisorPlot, { logoDataUrl: null }))
    assertContiene(texto, ['$ 29.260,00', '$ 14.044,80', 'IVA Contenido: $ 2.437,53'])
    assert.ok(!/-\s?\$|\$\s?-|-14\.044/.test(texto), `no debería haber importes negativos: ${texto}`)
    assert.equal(buildAfipQrPayload(nota, emisorPlot.cuit)?.importe, 14044.8)
  })
})
