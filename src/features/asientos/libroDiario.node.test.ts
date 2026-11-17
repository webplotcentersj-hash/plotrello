import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { leerPdf, assertContiene } from '../../utils/documentos/leerPdfTest.ts'
import { buildLibroDiarioPdf, libroDiarioCsv } from '../../utils/documentos/libroDiarioPdf.ts'
import {
  asientosFueraDeOrden,
  buscarEnAsiento,
  comprobanteRespaldatorio,
  contraasiento,
  controlesAsiento,
  ejercicioDe,
  lineasFormaDiario,
  numerosDeOrden,
  puedeContabilizar,
  resumenLibro,
  type AsientoLD
} from './libroDiario.ts'

const cuenta = (id: number, codigo: string, nombre: string) => ({ id, codigo, nombre, activa: true })
const CLIENTES = cuenta(1, '1.1.3.01', 'Deudores por ventas')
const VENTAS = cuenta(2, '4.1.1.01', 'Ventas')
const IVA = cuenta(3, '2.1.3.01', 'IVA Débito Fiscal')
const CAJA = cuenta(4, '1.1.1.01', 'Caja')

let seq = 0
function asiento(cambios: Partial<AsientoLD> = {}): AsientoLD {
  seq++
  return {
    id: seq,
    numero_asiento: `AS-${String(seq).padStart(4, '0')}`,
    fecha: '2026-11-10',
    concepto: 'Factura B 0001-00000010 - Cliente',
    tipo_asiento: 'Facturación',
    tipo_origen: 'factura',
    id_origen: 10,
    estado: 'Contabilizado',
    total_debe: 1210,
    total_haber: 1210,
    detalles: [
      { id_cuenta: 2, debe: 0, haber: 1000, cuenta: VENTAS },
      { id_cuenta: 1, debe: 1210, haber: 0, cuenta: CLIENTES },
      { id_cuenta: 3, debe: 0, haber: 210, cuenta: IVA }
    ],
    ...cambios
  }
}

describe('controles de un asiento', () => {
  it('un asiento correcto no tiene errores ni avisos', () => {
    assert.deepEqual(controlesAsiento(asiento()), [])
  })

  it('partida doble, lados y totales de cabecera', () => {
    const malo = asiento({
      estado: 'Borrador',
      total_debe: 100,
      total_haber: 100,
      detalles: [{ id_cuenta: 1, debe: 100, haber: 0, cuenta: CLIENTES }]
    })
    const codigos = controlesAsiento(malo).map((c) => c.codigo)
    assert.ok(codigos.includes('pocas-lineas'))
    assert.ok(codigos.includes('sin-haber'))
    assert.ok(codigos.includes('desbalance'))
    assert.equal(puedeContabilizar(malo), false)
  })

  it('una línea no puede tener debe y haber a la vez ni importes negativos', () => {
    const malo = asiento({
      detalles: [
        { id_cuenta: 1, debe: 100, haber: 100, cuenta: CLIENTES },
        { id_cuenta: 2, debe: -5, haber: 0, cuenta: VENTAS }
      ]
    })
    const codigos = controlesAsiento(malo).map((c) => c.codigo)
    assert.ok(codigos.includes('ambos-0'))
    assert.ok(codigos.includes('negativo-1'))
  })

  it('un manual sin comprobante es aviso (no impide contabilizar)', () => {
    const manual = asiento({ estado: 'Borrador', tipo_asiento: 'Manual', tipo_origen: null, id_origen: null, observaciones: null })
    const c = controlesAsiento(manual)
    assert.deepEqual(c.map((x) => x.codigo), ['sin-comprobante'])
    assert.equal(c[0].nivel, 'aviso')
    assert.equal(puedeContabilizar(manual), true)
    assert.equal(comprobanteRespaldatorio({ ...manual, observaciones: 'Recibo X 0001-00000099' }), 'Recibo X 0001-00000099')
  })
})

describe('orden y numeración del Libro Diario', () => {
  it('el N° de orden sigue la fecha, no el número interno, y reinicia por ejercicio', () => {
    const a = asiento({ fecha: '2026-11-10', numero_asiento: 'AS-0005' })
    const b = asiento({ fecha: '2026-11-02', numero_asiento: 'AS-0009' }) // cargado después con fecha anterior
    const c = asiento({ fecha: '2026-11-10', numero_asiento: 'AS-0003' })
    const borrador = asiento({ fecha: '2026-11-01', estado: 'Borrador' })
    const d = asiento({ fecha: '2027-01-03', numero_asiento: 'AS-0010' })
    const orden = numerosDeOrden([a, b, c, borrador, d])
    assert.equal(orden.get(b.id), 1)
    assert.equal(orden.get(c.id), 2)
    assert.equal(orden.get(a.id), 3)
    assert.equal(orden.get(borrador.id), undefined, 'los borradores no van al libro')
    assert.equal(orden.get(d.id), 1, 'nuevo ejercicio')
    assert.equal(asientosFueraDeOrden([a, b, c]), 1, 'solo b se cargó tarde')
    // Uno cargado tarde con número alto no arrastra a los que le siguen
    const serie = [1, 2, 3, 4, 5].map((k) => asiento({ fecha: `2026-12-0${k}`, numero_asiento: `AS-${k === 2 ? 99 : k}` }))
    assert.equal(asientosFueraDeOrden(serie), 1)
  })

  it('ejercicio con cierre a mitad de año', () => {
    assert.equal(ejercicioDe('2026-11-10'), '2026')
    assert.equal(ejercicioDe('2026-11-10', '07-01'), '2026/2027')
    assert.equal(ejercicioDe('2026-03-10', '07-01'), '2025/2026')
  })

  it('forma del Diario: primero el debe, después "a" el haber', () => {
    const l = lineasFormaDiario(asiento().detalles ?? [])
    assert.equal(l[0].cuenta?.nombre, 'Deudores por ventas')
    assert.deepEqual(l.slice(1).map((x) => x.cuenta?.nombre), ['Ventas', 'IVA Débito Fiscal'])
  })
})

describe('resumen y correcciones', () => {
  it('resumen: balance del libro, borradores viejos y errores', () => {
    const r = resumenLibro(
      [
        asiento(),
        asiento({ estado: 'Borrador', fecha: '2026-10-20' }),
        asiento({ estado: 'Anulado', total_debe: 9, total_haber: 9, detalles: [] }),
        asiento({ estado: 'Borrador', detalles: [] })
      ],
      '2026-11-17'
    )
    assert.equal(r.contabilizados, 1)
    assert.equal(r.borradores, 2)
    assert.equal(r.anulados, 1)
    assert.equal(r.debe, 1210)
    assert.equal(r.balancea, true)
    assert.equal(r.borradoresViejos, 1)
    assert.equal(r.conErrores, 1, 'el anulado no cuenta')
  })

  it('contraasiento: invierte debe y haber y referencia al original', () => {
    const orig = asiento()
    const c = contraasiento(orig, '2026-11-17', 'cuenta mal imputada')
    assert.equal(c.tipo_origen, 'contraasiento')
    assert.equal(c.id_origen, orig.id)
    assert.match(c.concepto, new RegExp(`^Contraasiento de ${orig.numero_asiento}: cuenta mal imputada`))
    const clientes = c.detalles.find((d) => d.id_cuenta === 1)
    assert.deepEqual([clientes?.debe, clientes?.haber], [0, 1210])
    const sum = c.detalles.reduce((s, d) => [s[0] + d.debe, s[1] + d.haber], [0, 0])
    assert.deepEqual(sum, [1210, 1210])
  })

  it('búsqueda por número, leyenda o cuenta', () => {
    const a = asiento()
    assert.ok(buscarEnAsiento(a, 'iva débito'))
    assert.ok(buscarEnAsiento(a, a.numero_asiento.toLowerCase()))
    assert.ok(!buscarEnAsiento(a, 'proveedores'))
  })
})

describe('Libro Diario (PDF y CSV)', () => {
  const emisor = {
    cuit: '30715518801',
    razon_social: 'PLOT CENTER SRL',
    domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
    condicion_iva: 'Responsable Inscripto',
    ingresos_brutos: '30-71551880-1',
    fecha_inicio_actividades: '2017-01-27'
  }

  it('encabezado, orden, forma del diario, comprobante y totales', async () => {
    const a = asiento({ fecha: '2026-11-10' })
    const b = asiento({
      fecha: '2026-11-03',
      concepto: 'Cobro en efectivo',
      tipo_asiento: 'Tesorería',
      tipo_origen: 'pago_cobro',
      id_origen: 7,
      total_debe: 500,
      total_haber: 500,
      detalles: [
        { id_cuenta: 4, debe: 500, haber: 0, cuenta: CAJA },
        { id_cuenta: 1, debe: 0, haber: 500, cuenta: CLIENTES }
      ]
    })
    const borrador = asiento({ estado: 'Borrador', concepto: 'NO DEBE SALIR' })
    const doc = await buildLibroDiarioPdf([a, b, borrador], { desde: '2026-11-01', hasta: '2026-11-30' }, emisor)
    const { texto, paginas } = await leerPdf(doc)
    assertContiene(assert, texto, [
      'PLOT CENTER SRL',
      'CUIT 30-71551880-1',
      'LIBRO DIARIO',
      'Del 01/11/2026 al 30/11/2026 - Hoja 1',
      '03/11/2026',
      '1.1.1.01 Caja',
      'a 1.1.3.01 Deudores por ventas',
      'Comprobante: Cobro/Pago #7',
      'a 4.1.1.01 Ventas',
      'Comprobante: Factura #10',
      'Totales del período (2 asientos)',
      '1.710,00'
    ])
    assert.ok(!texto.includes('NO DEBE SALIR'), 'los borradores no van al libro')
    assert.ok(texto.indexOf('Cobro en efectivo') < texto.indexOf('Factura B'), 'orden cronológico')
    assert.equal(paginas, 1)
  })

  it('muchas hojas: transporte al pie y al comienzo, hojas numeradas desde la indicada', async () => {
    const muchos = Array.from({ length: 60 }, (_, i) => asiento({ fecha: `2026-11-${String((i % 28) + 1).padStart(2, '0')}` }))
    const doc = await buildLibroDiarioPdf(muchos, { desde: '2026-11-01', hasta: '2026-11-30', primeraHoja: 15 }, emisor)
    const { porPagina, paginas } = await leerPdf(doc)
    assert.ok(paginas > 1)
    assert.ok(porPagina[0].includes('Hoja 15'))
    assert.ok(porPagina[1].includes('Hoja 16'))
    assert.ok(porPagina[0].includes('Transporte'), 'transporte al pie de la primera')
    assert.ok(porPagina[1].startsWith('PLOT CENTER') && porPagina[1].includes('Transporte'), 'y al comienzo de la siguiente')
    assert.ok(porPagina[paginas - 1].includes(`Totales del período (60 asientos) ${(1210 * 60).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`))
  })

  it('CSV con N° de orden y comprobante', () => {
    const filas = libroDiarioCsv([asiento({ fecha: '2026-11-05' })], '2026-11-01', '2026-11-30')
    assert.equal(filas.length, 3)
    assert.equal(filas[0][1], '1')
    assert.equal(filas[0][4], 'Deudores por ventas')
    assert.equal(filas[0][5], '1210,00')
    assert.equal(filas[0][8], 'Factura #10')
  })
})
