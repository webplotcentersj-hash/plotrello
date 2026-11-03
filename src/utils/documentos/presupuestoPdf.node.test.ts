import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { PresupuestoPlanillaPayload } from '../presupuestoPlanillaPdf.ts'
import { assertContiene, leerPdf } from './leerPdfTest.ts'
import { buildPresupuestoA4Pdf, nombreArchivoPresupuesto } from './presupuestoPdf.ts'

const LOGO = `data:image/png;base64,${readFileSync(new URL('../../../public/factura/plot-center-pc.png', import.meta.url)).toString('base64')}`
const emisor = {
  cuit: '30715518801',
  razon_social: 'PLOT CENTER SRL',
  domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
  condicion_iva: 'Responsable Inscripto',
  ingresos_brutos: '30-71551880-1',
  fecha_inicio_actividades: '2017-01-27'
}

// Lo que arma presupuestoVentaPdf.toPlanillaPayload: precios con IVA incluido y el total partido en neto + IVA.
const conIva: PresupuestoPlanillaPayload = {
  numero: 'PRE-2026-0042',
  fecha: '03/11/2026',
  validez_hasta: '18/11/2026',
  cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
  cliente_empresa: 'Rodríguez Publicidad',
  cliente_dni_cuit: '20-94205103-3',
  cliente_telefono: '264 555 0101',
  cliente_email: 'alberto@example.com',
  cliente_direccion: 'Calle Falsa 123, San Juan',
  lista_label: 'Lista: Lista 1 (Mostrador)',
  items: [
    { codigo: 'VIN01', descripcion: 'Vinilo impreso + pre corte x m2', cantidad: 12.5, unidad: 'm2', precio_unitario: 29260, subtotal: 365750 },
    { codigo: 'LON02', descripcion: 'Lona frontlight con ojales', cantidad: 3, unidad: 'm2', precio_unitario: 18000, subtotal: 54000 },
    { descripcion: 'Colocación en obra', cantidad: 1, unidad: 'un', precio_unitario: 25000, subtotal: 25000 }
  ],
  total: 444750,
  desglose: { neto: 367561.98, iva: 77188.02, iva_porcentaje: 21, recargos: [] },
  notas: 'Precios sujetos a disponibilidad. Este presupuesto no constituye factura.',
  vendedor: 'Ana López',
  formas_pago: ['Efectivo', 'Transferencia bancaria']
}

describe('Presupuesto A4 (PDF)', () => {
  it('con IVA: datos del cliente, líneas con unidad, neto + IVA + total, formas de pago y firma', async () => {
    const { texto, imagenes, paginas } = await leerPdf(await buildPresupuestoA4Pdf(conIva, emisor, { logoDataUrl: LOGO }))
    assertContiene(assert, texto, [
      'PRESUPUESTO',
      'NO FISCAL',
      'Presupuesto N°: PRE-2026-0042',
      'Fecha de emisión: 03/11/2026',
      'Válido hasta: 18/11/2026',
      'PLOT CENTER SRL',
      'Cliente: RODRIGUEZ ALBERTO RUBEN',
      'Empresa: Rodríguez Publicidad',
      'CUIT / DNI: 20-94205103-3',
      'Lista de precios: Lista 1 (Mostrador)',
      'Vendedor: Ana López',
      'Vinilo impreso + pre corte x m2',
      '12,5 m',
      '$ 29.260,00',
      '$ 365.750,00',
      'Colocación en obra',
      'Subtotal (neto) $ 367.561,98',
      'IVA 21% $ 77.188,02',
      'TOTAL $ 444.750,00',
      'Formas de pago',
      'Efectivo - Transferencia bancaria',
      'Precios sujetos a disponibilidad',
      'Conforme del cliente',
      'Presupuesto - Documento no válido como factura'
    ])
    assert.ok(imagenes >= 1)
    assert.equal(paginas, 1)
  })

  it('sin IVA discriminado muestra solo el TOTAL', async () => {
    const { texto } = await leerPdf(await buildPresupuestoA4Pdf({ ...conIva, desglose: null }, emisor, { logoDataUrl: LOGO }))
    assert.ok(texto.includes('TOTAL $ 444.750,00'))
    assert.ok(!texto.includes('Subtotal (neto)') && !texto.includes('IVA 21%'))
  })

  it('con recargos los lista antes del IVA', async () => {
    const { texto } = await leerPdf(
      await buildPresupuestoA4Pdf(
        { ...conIva, desglose: { neto: 100, iva: 21, iva_porcentaje: 21, recargos: [{ nombre: 'Recargo tarjeta', porcentaje: 10, monto: 10 }] } },
        emisor,
        { logoDataUrl: LOGO }
      )
    )
    assert.ok(texto.indexOf('Recargo tarjeta 10% $ 10,00') > texto.indexOf('Subtotal (neto)'))
    assert.ok(texto.indexOf('IVA 21%') > texto.indexOf('Recargo tarjeta'))
  })

  it('sin validez, sin formas de pago ni notas, no deja secciones vacías', async () => {
    const minimo: PresupuestoPlanillaPayload = {
      numero: 'EMB-7',
      fecha: '03/11/2026',
      cliente_nombre: 'Consumidor',
      items: [{ descripcion: 'Sticker', cantidad: 10, precio_unitario: 100, subtotal: 1000 }],
      total: 1000
    }
    const { texto } = await leerPdf(await buildPresupuestoA4Pdf(minimo, emisor, { logoDataUrl: LOGO }))
    assert.ok(!texto.includes('Válido hasta') && !texto.includes('Formas de pago') && !texto.includes('Observaciones'))
    assertContiene(assert, texto, ['EMB-7', 'Sticker', '10 m', 'TOTAL $ 1.000,00'])
  })

  it('con muchos ítems pasa de página con encabezado y cabecera repetidos, sin perder líneas', async () => {
    const muchos: PresupuestoPlanillaPayload = {
      ...conIva,
      items: Array.from({ length: 60 }, (_, i) => ({ descripcion: `ITEM ${i + 1} - Impresión gran formato con laminado`, cantidad: 1, unidad: 'm2', precio_unitario: 100, subtotal: 100 })),
      total: 6000,
      desglose: null
    }
    const { porPagina, paginas, xMin, xMax } = await leerPdf(await buildPresupuestoA4Pdf(muchos, emisor, { logoDataUrl: LOGO }))
    assert.ok(paginas >= 2)
    porPagina.forEach((t, i) => {
      assert.ok(t.includes('PRESUPUESTO'), `p${i + 1}: encabezado`)
      if (/ITEM [0-9]+/.test(t)) assert.ok(t.includes('Descripción'), `p${i + 1}: cabecera de la tabla`)
      assert.ok(t.includes(`Página ${i + 1} de ${paginas}`))
    })
    const lineas = porPagina.join(' ').match(/ITEM (\d+)/g) ?? []
    assert.equal(lineas.length, 60)
    assert.ok(porPagina.join(' ').includes('TOTAL $ 6.000,00'), 'el total se imprime')
    assert.ok(porPagina[paginas - 1].includes('Conforme del cliente'), 'la firma queda al final')
    assert.ok(xMin >= 28 && xMax <= 568)
  })

  it('nombre de archivo sin caracteres raros', () => {
    assert.equal(nombreArchivoPresupuesto('PRE 2026/0042'), 'Presupuesto_PRE_2026_0042.pdf')
  })
})
