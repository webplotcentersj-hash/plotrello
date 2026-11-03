import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { Remito } from '../../features/remitos/remitosLogica.ts'
import { assertContiene, leerPdf } from './leerPdfTest.ts'
import { buildRemitoPdf, nombreArchivoRemito } from './remitoPdf.ts'

const LOGO = `data:image/png;base64,${readFileSync(new URL('../../../public/factura/plot-center-pc.png', import.meta.url)).toString('base64')}`
const emisor = {
  cuit: '30715518801',
  razon_social: 'PLOT CENTER SRL',
  domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
  condicion_iva: 'Responsable Inscripto',
  ingresos_brutos: '30-71551880-1',
  fecha_inicio_actividades: '2017-01-27'
}

const base: Remito = {
  id: 12,
  tipo: 'X',
  punto_venta: 1,
  numero: 12,
  estado: 'Emitido',
  id_venta: 5,
  numero_venta: 'V-2026-0005',
  id_op: 9,
  numero_op: 'OP-1042',
  cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
  cliente_documento: '20-94205103-3',
  cliente_domicilio: 'Calle Falsa 123, San Juan',
  cliente_telefono: '264 555 0101',
  fecha_emision: '2026-11-03',
  fecha_entrega: '2026-11-04',
  entregado_a: 'Juan Pérez',
  dni_retira: '30111222',
  transportista: 'Retira en local',
  observaciones: 'Entregar en horario de mañana.',
  usuario_nombre: 'Ana',
  items: [
    { orden: 1, id_venta_item: 1, codigo_articulo: 'A1', descripcion: 'Cartel 1x1 en lona con bastidor', cantidad: 4, cantidad_pedida: 10, cantidad_previa: 0 },
    { orden: 2, id_op_linea: 7, descripcion: 'Lona frontlight', unidad: 'm²', cantidad: 5.5, cantidad_pedida: 12.5, cantidad_previa: 0 },
    { orden: 3, descripcion: 'Muestra sin cargo', cantidad: 2 }
  ]
}

describe('Remito X (PDF)', () => {
  it('parcial: muestra pedido, entregado antes, esta entrega y saldo por línea', async () => {
    const doc = await buildRemitoPdf(base, emisor, { logoDataUrl: LOGO, numeroEntrega: 1 })
    const { texto, imagenes, paginas } = await leerPdf(doc)
    assertContiene(assert, texto, [
      'REMITO',
      'NO FISCAL',
      'Remito N°: 0001-00000012',
      'Fecha de emisión: 03/11/2026',
      'Entrega: Parcial N° 1',
      'PLOT CENTER SRL',
      'CUIT: 30-71551880-1',
      'Señor/es: RODRIGUEZ ALBERTO RUBEN',
      'CUIT / DNI: 20-94205103-3',
      'Venta: V-2026-0005',
      'OP: OP-1042',
      'Fecha de entrega: 04/11/2026',
      'Retira / recibe: Juan Pérez',
      'Pedido',
      'Entregado antes',
      'Esta entrega',
      'Saldo',
      'Cartel 1x1 en lona con bastidor',
      '12,5 m²',
      '5,5 m²',
      '7 m²',
      'Muestra sin cargo',
      'ENTREGA PARCIAL',
      'Entregar en horario de mañana.',
      'Recibí conforme',
      'Remito X - Documento no válido como factura',
      'Página 1 de 1'
    ])
    assert.ok(imagenes >= 1, 'lleva el logo')
    assert.equal(paginas, 1)
    assert.ok(!/ANULADO/.test(texto))
  })

  it('la entrega que completa el pedido no se marca como parcial', async () => {
    const completo: Remito = {
      ...base,
      items: [{ orden: 1, id_venta_item: 1, descripcion: 'Cartel 1x1', cantidad: 6, cantidad_pedida: 10, cantidad_previa: 4 }]
    }
    const { texto } = await leerPdf(await buildRemitoPdf(completo, emisor, { logoDataUrl: LOGO, numeroEntrega: 2 }))
    assertContiene(assert, texto, ['Entrega: Final N° 2', 'Entregado antes', '10', '4', '6'])
    assert.ok(!texto.includes('ENTREGA PARCIAL'))
  })

  it('un remito de líneas libres usa la tabla simple, sin saldo', async () => {
    const libre: Remito = { ...base, id_venta: null, numero_venta: null, items: [{ orden: 1, descripcion: 'Flete a obra', cantidad: 1 }] }
    const { texto } = await leerPdf(await buildRemitoPdf(libre, emisor, { logoDataUrl: LOGO }))
    assertContiene(assert, texto, ['Cantidad', 'Flete a obra'])
    assert.ok(!texto.includes('Entregado antes') && !texto.includes('Saldo'))
    assert.ok(!texto.includes('Venta:'))
  })

  it('anulado: lleva el sello, el motivo y la marca diagonal', async () => {
    const an: Remito = { ...base, estado: 'Anulado', anulado_motivo: 'Cargado por error', anulado_at: '2026-11-05T14:00:00Z' }
    const { texto } = await leerPdf(await buildRemitoPdf(an, emisor, { logoDataUrl: LOGO }))
    assertContiene(assert, texto, ['ANULADO', 'REMITO ANULADO', 'Cargado por error', '05/11/2026'])
    assert.ok(!texto.includes('ENTREGA PARCIAL'), 'un remito anulado no se presenta como entrega')
  })

  it('con muchas líneas pasa de página repitiendo encabezado y cabecera de tabla', async () => {
    const muchas: Remito = {
      ...base,
      items: Array.from({ length: 70 }, (_, i) => ({
        orden: i + 1,
        id_venta_item: 100 + i,
        codigo_articulo: `C${i}`,
        descripcion: `ITEM ${i + 1} - Vinilo impreso y laminado con terminación especial para vidriera`,
        cantidad: 1,
        cantidad_pedida: 3,
        cantidad_previa: 0
      }))
    }
    const { porPagina, paginas, xMin, xMax } = await leerPdf(await buildRemitoPdf(muchas, emisor, { logoDataUrl: LOGO }))
    assert.ok(paginas >= 3, `esperaba varias páginas y fueron ${paginas}`)
    porPagina.forEach((t, i) => {
      assert.ok(t.includes('REMITO') && t.includes('PLOT CENTER SRL'), `p${i + 1}: encabezado`)
      assert.ok(t.includes('Descripción') && t.includes('Saldo'), `p${i + 1}: cabecera de tabla`)
      assert.ok(t.includes(`Página ${i + 1} de ${paginas}`), `p${i + 1}: numeración`)
    })
    assert.ok(porPagina[1].includes('Continuación'))
    const lineas = porPagina.join(' ').match(/ITEM (\d+)/g)?.map((s) => Number(s.slice(5))) ?? []
    assert.equal(lineas.length, 70, 'no se pierde ninguna línea')
    assert.deepEqual(lineas, [...lineas].sort((a, b) => a - b), 'en orden')
    assert.ok(porPagina[paginas - 1].includes('Recibí conforme'), 'las firmas quedan al final')
    assert.ok(xMin >= 28 && xMax <= 568, `el texto queda dentro de los márgenes (${Math.round(xMin)}–${Math.round(xMax)} pt)`)
  })

  it('sin logo igual se genera y el nombre de archivo es estable', async () => {
    const { texto, imagenes } = await leerPdf(await buildRemitoPdf(base, emisor, { logoDataUrl: null }))
    assert.equal(imagenes, 0)
    assert.ok(texto.includes('REMITO'))
    assert.equal(nombreArchivoRemito(base), 'Remito_X_0001-00000012.pdf')
  })

  it('los datos del cliente con caracteres raros no rompen el PDF', async () => {
    const raro: Remito = { ...base, cliente_nombre: 'ÑANDÚ & Hijos <S.A.> “Premium” – Ltda…', items: [{ orden: 1, descripcion: 'Cartel 50×50 – “luz” ½', cantidad: 1 }] }
    const { texto } = await leerPdf(await buildRemitoPdf(raro, emisor, { logoDataUrl: LOGO }))
    assertContiene(assert, texto, ['ÑANDÚ & Hijos <S.A.> "Premium" - Ltda...', 'Cartel 50'])
  })
})
