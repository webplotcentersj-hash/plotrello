import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { CcPerfilCliente } from '../../types/api'
import { buildEstadoCuentaPdf, datosEstadoCuentaDesdePerfil, movimientosConSaldo, nombreArchivoEstadoCuenta, type DatosEstadoCuenta } from './estadoCuentaPdf.ts'
import { assertContiene, leerPdf } from './leerPdfTest.ts'
import { montoEnLetras } from './numeroALetras.ts'
import { buildOrdenCompraPdf, cantidadAPedir, type DatosOrdenCompra } from './ordenCompraPdf.ts'
import { buildOrdenEntregaPdf, type DatosOrdenEntrega } from './ordenEntregaPdf.ts'
import { buildReciboPdf, nombreArchivoRecibo, numeroRecibo, saldoTrasCobro, type DatosRecibo } from './reciboPdf.ts'

const LOGO = `data:image/png;base64,${readFileSync(new URL('../../../public/factura/plot-center-pc.png', import.meta.url)).toString('base64')}`
const emisor = {
  cuit: '30715518801',
  razon_social: 'PLOT CENTER SRL',
  domicilio_comercial: 'Avenida Libertador Este 580, San Juan',
  condicion_iva: 'Responsable Inscripto',
  ingresos_brutos: '30-71551880-1',
  fecha_inicio_actividades: '2017-01-27'
}
const opc = { logoDataUrl: LOGO }

describe('importe en letras', () => {
  const casos: Array<[number, string]> = [
    [0, 'cero con 00/100'],
    [1, 'uno con 00/100'],
    [15, 'quince con 00/100'],
    [21, 'veintiuno con 00/100'],
    [30, 'treinta con 00/100'],
    [31, 'treinta y uno con 00/100'],
    [100, 'cien con 00/100'],
    [101, 'ciento uno con 00/100'],
    [999, 'novecientos noventa y nueve con 00/100'],
    [1000, 'mil con 00/100'],
    [1500.5, 'mil quinientos con 50/100'],
    [2000, 'dos mil con 00/100'],
    [21000, 'veintiún mil con 00/100'],
    [31000, 'treinta y un mil con 00/100'],
    [100000, 'cien mil con 00/100'],
    [444750, 'cuatrocientos cuarenta y cuatro mil setecientos cincuenta con 00/100'],
    [14044.8, 'catorce mil cuarenta y cuatro con 80/100'],
    [1000000, 'un millón con 00/100'],
    [1000001, 'un millón uno con 00/100'],
    [2000000, 'dos millones con 00/100'],
    [21000000, 'veintiún millones con 00/100'],
    [1001001, 'un millón mil uno con 00/100'],
    [1000000000, 'mil millones con 00/100'],
    [2500000000, 'dos mil quinientos millones con 00/100'],
    [-250, 'doscientos cincuenta con 00/100']
  ]
  for (const [monto, esperado] of casos) {
    it(`${monto} → ${esperado}`, () => assert.equal(montoEnLetras(monto), esperado))
  }
})

describe('Recibo de cobranza', () => {
  const cobros = [
    { id: 1, monto: 300, fecha_pago: '2026-11-01' },
    { id: 2, monto: 200, fecha_pago: '2026-11-02' },
    { id: 3, monto: 100, fecha_pago: '2026-11-02' }
  ]

  it('el saldo se calcula con lo cobrado antes, por fecha y orden de carga', () => {
    assert.deepEqual(saldoTrasCobro(1000, cobros, cobros[0]), { previos: 0, este: 300, saldo: 700 })
    assert.deepEqual(saldoTrasCobro(1000, cobros, cobros[1]), { previos: 300, este: 200, saldo: 500 })
    assert.deepEqual(saldoTrasCobro(1000, cobros, cobros[2]), { previos: 500, este: 100, saldo: 400 })
  })

  it('un cobro cargado fuera de orden no cambia lo anterior', () => {
    const tarde = [...cobros, { id: 9, monto: 50, fecha_pago: '2026-10-30' }]
    assert.equal(saldoTrasCobro(1000, tarde, cobros[0]).previos, 50)
  })

  it('el saldo nunca es negativo si se cobró de más', () => {
    assert.equal(saldoTrasCobro(100, [{ id: 1, monto: 150, fecha_pago: '2026-11-01' }], { id: 1, monto: 150, fecha_pago: '2026-11-01' }).saldo, 0)
  })

  it('numera con el id del cobro', () => {
    assert.equal(numeroRecibo(3), '0001-00000003')
    assert.equal(nombreArchivoRecibo(123), 'Recibo_X_0001-00000123.pdf')
  })

  const datos: DatosRecibo = {
    cobro: { id: 3, monto: 100, fecha_pago: '2026-11-02', metodo_pago: 'Transferencia', observaciones: 'Seña del segundo cartel', usuario_nombre: 'Ana' },
    venta: { numero_venta: 'V-2026-0005', numero_op: 'OP-1042', cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN', cliente_dni_cuit: '20-94205103-3', cliente_direccion: 'Calle Falsa 123', cliente_telefono: '264 555 0101', valor_total: 1000 },
    cobros,
    factura: 'B 0014-00000692'
  }

  it('el PDF muestra el importe en letras, la imputación y el saldo', async () => {
    const { texto, paginas } = await leerPdf(await buildReciboPdf(datos, emisor, opc))
    assertContiene(assert, texto, [
      'RECIBO',
      'NO FISCAL',
      'Recibo N°: 0001-00000003',
      'Fecha de cobro: 02/11/2026',
      'Recibimos de: RODRIGUEZ ALBERTO RUBEN',
      'CUIT / DNI: 20-94205103-3',
      'Venta: V-2026-0005',
      'Factura: B 0014-00000692',
      'La suma de pesos',
      'CIEN CON 00/100',
      'Cobro de la venta V-2026-0005 (pago a cuenta)',
      'Forma de pago: Transferencia - Seña del segundo cartel',
      'Total de la venta $ 1.000,00',
      'Cobrado anteriormente $ 500,00',
      'Este recibo $ 100,00',
      'Saldo pendiente $ 400,00',
      'Recibió - Ana'
    ])
    assert.equal(paginas, 1)
  })

  it('el cobro que cancela la venta lo dice', async () => {
    const final = { ...datos, cobro: { ...datos.cobro, id: 4, monto: 400, fecha_pago: '2026-11-03' }, cobros: [...cobros, { id: 4, monto: 400, fecha_pago: '2026-11-03' }] }
    const { texto } = await leerPdf(await buildReciboPdf(final, emisor, opc))
    assertContiene(assert, texto, ['CUATROCIENTOS CON 00/100', 'Saldo Cancelado'])
    assert.ok(!texto.includes('Saldo pendiente'))
  })

  it('el primer cobro no se marca como pago a cuenta', async () => {
    const { texto } = await leerPdf(await buildReciboPdf({ ...datos, cobro: cobros[0] as never }, emisor, opc))
    assert.ok(!texto.includes('(pago a cuenta)'))
  })
})

describe('Orden de entrega', () => {
  const datos: DatosOrdenEntrega = {
    venta: { numero_venta: 'V-2026-0005', numero_op: 'OP-1042', cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN', cliente_dni_cuit: '20-94205103-3', cliente_direccion: 'Calle Falsa 123', nombre_vendedor: 'Ana López', estado_pago: 'Parcial', valor_total: 1000, monto_pagado: 600, observaciones: 'Entregar con el vinilo enrollado.' },
    items: [
      { codigo_articulo: 'A1', descripcion: 'Cartel 1x1 en lona con bastidor', cantidad: 10, observaciones: 'Con ojales' },
      { descripcion: 'Lona frontlight', cantidad: 12.5 }
    ],
    fecha_entrega: '05/11/2026',
    fecha: '2026-11-03'
  }

  it('lista lo que se entrega, sin precios, e indica el saldo a cobrar', async () => {
    const { texto } = await leerPdf(await buildOrdenEntregaPdf(datos, emisor, opc))
    assertContiene(assert, texto, [
      'ORDEN DE ENTREGA',
      'Venta N°: V-2026-0005',
      'Fecha de emisión: 03/11/2026',
      'Entrega: 05/11/2026',
      'Cliente: RODRIGUEZ ALBERTO RUBEN',
      'OP: OP-1042',
      'Vendedor: Ana López',
      'Estado de pago: Parcial',
      'Total de la venta: $ 1.000,00',
      'Cobrado: $ 600,00',
      'Saldo a cobrar: $ 400,00',
      'Cartel 1x1 en lona con bastidor',
      'Con ojales',
      '12,5',
      'Entregar con el vinilo enrollado.',
      'Autoriza (Plot Center)',
      'Recibe (firma, aclaración y DNI)',
      'Orden de entrega - Documento no válido como factura ni como remito'
    ])
    assert.ok(!texto.includes('Precio unit.'), 'sin precios por línea')
  })

  it('sin datos de pago no imprime el recuadro de pago', async () => {
    const sin = { ...datos, venta: { ...datos.venta, valor_total: undefined, monto_pagado: undefined, estado_pago: undefined } }
    const { texto } = await leerPdf(await buildOrdenEntregaPdf(sin, emisor, opc))
    assert.ok(!texto.includes('Saldo a cobrar') && !texto.includes('Estado de pago'))
  })

  it('una venta pagada no muestra saldo', async () => {
    const { texto } = await leerPdf(await buildOrdenEntregaPdf({ ...datos, venta: { ...datos.venta, monto_pagado: 1000, estado_pago: 'Pagado' } }, emisor, opc))
    assertContiene(assert, texto, ['Saldo a cobrar: Sin saldo'])
  })

  it('sin líneas lo avisa en vez de dejar la tabla vacía', async () => {
    const { texto } = await leerPdf(await buildOrdenEntregaPdf({ ...datos, items: [] }, emisor, opc))
    assert.ok(texto.includes('La venta no tiene líneas cargadas'))
  })
})

describe('Orden de compra', () => {
  const datos: DatosOrdenCompra = {
    pedido: { numero_pedido: 'PC-2026-0031', fecha_solicitud: '2026-10-28', fecha_aprobacion: '2026-10-30', fecha_entrega_estimada: '2026-11-10', nombre_solicitante: 'Luis Gómez', sector_solicitante: 'Taller gráfico', prioridad: 'Alta', motivo: 'Reposición de stock', observaciones: 'Entregar en el depósito.', nombre_aprobador: 'Marta Díaz' },
    proveedor: { nombre: 'Insumos SA', razon_social: 'INSUMOS GRAFICOS SA', cuit: '30-12345678-9', condicion_iva: 'Responsable Inscripto', contacto_nombre: 'Carlos', telefono: '264 400 1122', email: 'ventas@insumos.test', direccion: 'Ruta 40 km 10', ciudad: 'San Juan', provincia: 'San Juan' },
    items: [
      { codigo_articulo: 'VIN-ROLLO', descripcion: 'Rollo de vinilo blanco 1,22 x 50 m', cantidad_solicitada: 10, cantidad_aprobada: 8, unidad: 'rollos', precio_unitario: 100000 },
      { descripcion: 'Tinta eco-solvente', cantidad_solicitada: 4, unidad: 'lts', precio_unitario: 25000, observaciones: 'Color cyan' }
    ]
  }

  it('pide la cantidad aprobada y calcula el total estimado', async () => {
    assert.equal(cantidadAPedir(datos.items[0]), 8)
    assert.equal(cantidadAPedir(datos.items[1]), 4)
    const { texto } = await leerPdf(await buildOrdenCompraPdf(datos, emisor, opc))
    assertContiene(assert, texto, [
      'ORDEN DE COMPRA',
      'Orden N°: PC-2026-0031',
      'Fecha de emisión: 30/10/2026',
      'Entrega estimada: 10/11/2026',
      'Prioridad: Alta',
      'Proveedor: INSUMOS GRAFICOS SA',
      'CUIT: 30-12345678-9',
      'Domicilio: Ruta 40 km 10, San Juan, San Juan',
      'Solicitó: Luis Gómez',
      'Rollo de vinilo blanco 1,22 x 50 m',
      '8 rollos',
      '$ 800.000,00',
      '4 lts',
      'Color cyan',
      'TOTAL ESTIMADO $ 900.000,00',
      'Motivo',
      'Reposición de stock',
      'Autoriza - Marta Díaz',
      'Conforme proveedor'
    ])
    assert.ok(!texto.includes('NO FISCAL'), 'no es un comprobante X')
  })

  it('sin precios usa la tabla simple y no inventa totales', async () => {
    const sinPrecios = { ...datos, items: datos.items.map((i) => ({ ...i, precio_unitario: null })) }
    const { texto } = await leerPdf(await buildOrdenCompraPdf(sinPrecios, emisor, opc))
    assert.ok(!texto.includes('Precio unit.') && !texto.includes('TOTAL ESTIMADO'))
    assert.ok(texto.includes('Cantidad'))
  })

  it('sin proveedor definido lo indica', async () => {
    const { texto } = await leerPdf(await buildOrdenCompraPdf({ ...datos, proveedor: null }, emisor, opc))
    assert.ok(texto.includes('Proveedor: A definir'))
  })
})

describe('Estado de cuenta', () => {
  const datos: DatosEstadoCuenta = {
    cliente: { nombre: 'PEREZ HNOS SRL', cuit: '30-11111111-1', condicion_iva: 'Responsable Inscripto', domicilio: 'San Martín 100', email: 'perez@test.com', telefono: '264 555 0000' },
    resumen: { saldo_actual: 700, total_cargos: 1500, total_pagos: 800, limite_credito: 5000, ultimo_pago_at: '2026-10-20T15:00:00Z' },
    movimientos: [
      { id: 3, fecha: '2026-10-20', concepto: 'Pago - Transferencia', debe: 0, haber: 500 },
      { id: 1, fecha: '2026-10-01', concepto: 'Venta V-2026-0001', fecha_vencimiento: '2026-10-31', debe: 1000, haber: 0, referencia: 'OP-900' },
      { id: 2, fecha: '2026-10-10', concepto: 'Venta V-2026-0002', debe: 500, haber: 0 },
      { id: 4, fecha: '2026-10-25', concepto: 'Pago - Efectivo', debe: 0, haber: 300 }
    ],
    fecha: '2026-11-03'
  }

  it('ordena por fecha y calcula el saldo corrido', () => {
    const m = movimientosConSaldo(datos.movimientos)
    assert.deepEqual(m.map((x) => x.concepto), ['Venta V-2026-0001', 'Venta V-2026-0002', 'Pago - Transferencia', 'Pago - Efectivo'])
    assert.deepEqual(m.map((x) => x.saldo), [1000, 1500, 1000, 700])
  })

  it('si la base ya trae el saldo acumulado se respeta (saldo de apertura)', () => {
    const m = movimientosConSaldo([
      { id: 1, fecha: '2026-10-01', concepto: 'Venta', debe: 100, haber: 0, saldo_acumulado: 350 },
      { id: 2, fecha: '2026-10-02', concepto: 'Pago', debe: 0, haber: 50, saldo_acumulado: 300 }
    ])
    assert.deepEqual(m.map((x) => x.saldo), [350, 300])
  })

  it('el PDF muestra cliente, movimientos, totales y saldo a pagar', async () => {
    const { texto } = await leerPdf(await buildEstadoCuentaPdf(datos, emisor, opc))
    assertContiene(assert, texto, [
      'ESTADO DE CUENTA',
      'Emitido el: 03/11/2026',
      'Cliente: PEREZ HNOS SRL',
      'CUIT / DNI: 30-11111111-1',
      'Límite de crédito: $ 5.000,00',
      'Último pago: 20/10/2026',
      '01/10/2026',
      'Venta V-2026-0001',
      'OP-900',
      '31/10/2026',
      '$ 1.000,00',
      'Pago - Efectivo',
      'Total cargos $ 1.500,00',
      'Total pagos $ 800,00',
      'SALDO A PAGAR $ 700,00',
      'Saldo calculado con los movimientos registrados al 03/11/2026.'
    ])
    assert.ok(!texto.includes('NO FISCAL'))
  })

  it('un saldo negativo se informa a favor del cliente, en positivo', async () => {
    const { texto } = await leerPdf(await buildEstadoCuentaPdf({ ...datos, resumen: { ...datos.resumen, saldo_actual: -250 } }, emisor, opc))
    assertContiene(assert, texto, ['SALDO A FAVOR DEL CLIENTE $ 250,00'])
    assert.ok(!texto.includes('-250') && !texto.includes('$ -'))
  })

  it('sin movimientos lo dice, y con cientos pasa de página sin perder ninguno', async () => {
    const vacio = await leerPdf(await buildEstadoCuentaPdf({ ...datos, movimientos: [] }, emisor, opc))
    assert.ok(vacio.texto.includes('Sin movimientos'))
    const muchos = {
      ...datos,
      movimientos: Array.from({ length: 150 }, (_, i) => ({ id: i + 1, fecha: `2026-${String(1 + (i % 12)).padStart(2, '0')}-15`, concepto: `MOV-${i + 1}`, debe: 10, haber: 0 }))
    }
    const { porPagina, paginas, xMin, xMax } = await leerPdf(await buildEstadoCuentaPdf(muchos, emisor, opc))
    assert.ok(paginas >= 3)
    assert.equal((porPagina.join(' ').match(/MOV-\d+/g) ?? []).length, 150)
    porPagina.forEach((t, i) => assert.ok(t.includes('ESTADO DE CUENTA') && t.includes(`Página ${i + 1} de ${paginas}`)))
    assert.ok(xMin >= 28 && xMax <= 568)
  })

  it('arma el estado desde el perfil de cuenta corriente sin llevar datos internos', () => {
    const perfil = {
      ficha: { id: 1, id_cliente: 7, cuit: '30-11111111-1', razon_social: 'PEREZ HNOS SRL', condicion_iva: 'responsable_inscripto', email: 'perez@test.com', whatsapp: '2645550000', domicilio: 'San Martín 100', localidad: 'Capital', provincia: 'San Juan', score: 42, score_nivel: 'riesgo' },
      resumen: { saldo_actual: '700.50', total_cargos: 1500, total_pagos: 799.5, limite_credito: 5000, ultimo_pago_at: '2026-10-20T15:00:00Z', ventas_pendientes: 1, score: 42, score_nivel: 'riesgo' },
      movimientos: [{ id: 1, id_cliente: 7, tipo: 'venta', fecha: '2026-10-01', concepto: 'Venta V-1', debe: '1000', haber: 0, saldo_acumulado: 1000 }],
      ventas_cc: []
    } as unknown as CcPerfilCliente
    const d = datosEstadoCuentaDesdePerfil(perfil, 'PEREZ HNOS SRL', 'Responsable Inscripto')
    assert.equal(d.cliente.domicilio, 'San Martín 100, Capital, San Juan')
    assert.equal(d.cliente.condicion_iva, 'Responsable Inscripto')
    assert.equal(d.resumen.saldo_actual, 700.5)
    assert.deepEqual(d.movimientos[0], { id: 1, fecha: '2026-10-01', concepto: 'Venta V-1', tipo: 'venta', fecha_vencimiento: null, referencia: null, debe: 1000, haber: 0, saldo_acumulado: 1000 })
    assert.ok(!JSON.stringify(d).includes('score') && !JSON.stringify(d).includes('riesgo'), 'no se filtra el score del cliente')
  })

  it('el nombre de archivo no lleva caracteres raros', () => {
    assert.equal(nombreArchivoEstadoCuenta('PEREZ HNOS S.R.L.', '2026-11-03'), 'Estado_de_cuenta_PEREZ_HNOS_S.R.L._2026-11-03.pdf')
  })
})
