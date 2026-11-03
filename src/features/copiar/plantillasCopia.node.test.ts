import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FacturaItemRecord, FacturaVentaRecord, Venta, VentaItem } from '../../types/api'
import type { Task } from '../../types/board'
import { calcularLineaItem, calcularTotalesFactura } from '../../utils/afipFacturaUi.ts'
import { lineasDesdePendientes, type Remito } from '../remitos/remitosLogica.ts'
import type { PedidoCompra } from '../../types/pedidos'
import { plantillaFactura, plantillaOp, plantillaPedidoCompra, plantillaPresupuesto, plantillaRemito, plantillaVenta, seleccionDesdeCopia } from './plantillasCopia.ts'

const venta = {
  id: 55,
  numero_venta: 'VENT-20261101-0055',
  id_cliente: 7,
  cliente_nombre: '  RODRIGUEZ ALBERTO RUBEN ',
  cliente_dni_cuit: '20-94205103-3',
  cliente_telefono: '264 555 0101',
  cliente_email: 'alberto@example.com',
  cliente_empresa: 'Rodríguez Publicidad',
  cliente_direccion: 'Calle Falsa 123',
  id_op: 9,
  numero_op: 'OP-1042',
  valor_total: 444750,
  metodo_pago: 'Transferencia',
  estado_pago: 'Parcial',
  monto_pagado: 200000,
  fecha_venta: '2026-11-01',
  observaciones: 'Entregar con el vinilo enrollado.',
  comprobante_pago_url: 'https://x/y.png',
  mp_payment_id: '123'
} as unknown as Venta

const itemsVenta: VentaItem[] = [
  { id: 1, id_venta: 55, id_articulo_stock: 31, codigo_articulo: ' VIN01 ', descripcion: 'Vinilo impreso', cantidad: 12.5, precio_unitario: 29260, precio_total: 365750, descuento: 0, created_at: '2026-11-01' },
  { id: 2, id_venta: 55, id_articulo_stock: null, codigo_articulo: null, descripcion: 'Colocación', cantidad: 1, precio_unitario: 25000, precio_total: 24000, descuento: 1000, observaciones: 'En obra', created_at: '2026-11-01' }
]

describe('copiar una venta', () => {
  const p = plantillaVenta(venta, itemsVenta)

  it('lleva el cliente, las líneas y las observaciones', () => {
    assert.deepEqual(p.cliente, {
      id_cliente: 7,
      nombre: 'RODRIGUEZ ALBERTO RUBEN',
      dni_cuit: '20-94205103-3',
      telefono: '264 555 0101',
      email: 'alberto@example.com',
      empresa: 'Rodríguez Publicidad',
      direccion: 'Calle Falsa 123'
    })
    assert.equal(p.observaciones, 'Entregar con el vinilo enrollado.')
    assert.deepEqual(p.items[0], { id_articulo_stock: 31, codigo_articulo: 'VIN01', descripcion: 'Vinilo impreso', cantidad: 12.5, precio_unitario: 29260, descuento: 0 })
    assert.deepEqual(p.items[1], { descripcion: 'Colocación', cantidad: 1, precio_unitario: 25000, descuento: 1000, observaciones: 'En obra' })
  })

  it('no arrastra número, fecha, cobros, estado, método de pago, OP ni comprobantes', () => {
    const json = JSON.stringify(p)
    for (const prohibido of ['VENT-20261101-0055', 'OP-1042', 'Transferencia', 'Parcial', '200000', '2026-11-01', 'https://x', '"123"', '444750']) {
      assert.ok(!json.includes(prohibido), `se coló ${prohibido}`)
    }
    assert.deepEqual(Object.keys(p).sort(), ['cliente', 'items', 'observaciones'])
  })

  it('una venta sin líneas da una plantilla vacía de líneas, sin romper', () => {
    assert.deepEqual(plantillaVenta(venta, []).items, [])
  })
})

const facturaB: FacturaVentaRecord = {
  id: 692,
  numero_factura: '0014-00000692',
  punto_venta: 14,
  numero_comprobante: 692,
  tipo_comprobante: 'Factura B',
  fecha_emision: '2026-11-02',
  fecha_vencimiento: '2026-11-30',
  id_cliente: 7,
  cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
  cliente_dni_cuit: '20942051',
  cliente_direccion: 'Calle Falsa 123',
  cliente_condicion_iva: 'Consumidor Final',
  id_op: 9,
  numero_op: 'OP-1042',
  id_venta: 55,
  concepto: 2,
  fecha_servicio_desde: '2026-10-01',
  fecha_servicio_hasta: '2026-10-31',
  subtotal: 11607.27,
  descuento: 0,
  iva: 2437.53,
  total: 14044.8,
  estado: 'Emitida',
  estado_afip: 'Autorizada',
  cae: '86440688442835',
  fecha_vencimiento_cae: '2026-11-12',
  observaciones: 'Pago contra entrega',
  efectos_aplicados_at: '2026-11-02T10:00:00Z',
  id_asiento_contable: 3
}
const itemsFactura: FacturaItemRecord[] = [
  { id: 2, id_factura: 692, item_numero: 2, descripcion: 'Colocación', cantidad: 1, unidad_medida: null, precio_unitario: 1000, descuento: 0, iva_porcentaje: 21, iva_monto: 210, subtotal: 1000, total: 1210 },
  { id: 1, id_factura: 692, item_numero: 1, descripcion: 'VINILO IMPRESO + PRE CORTE X M2 (m2)', cantidad: 0.48, unidad_medida: 'm2', precio_unitario: 24181.82, descuento: 0, iva_porcentaje: 21, iva_monto: 2437.53, subtotal: 11607.27, total: 14044.8 }
]

describe('copiar una factura', () => {
  const p = plantillaFactura(facturaB, itemsFactura)!

  it('lleva tipo, concepto, observaciones, cliente y líneas en orden, con importes netos', () => {
    assert.equal(p.tipo_comprobante, 'Factura B')
    assert.equal(p.concepto, 2)
    assert.equal(p.observaciones, 'Pago contra entrega')
    assert.deepEqual(p.cliente, { id_cliente: 7, nombre: 'RODRIGUEZ ALBERTO RUBEN', dni_cuit: '20942051', direccion: 'Calle Falsa 123', condicion_iva: 'Consumidor Final' })
    assert.deepEqual(p.items.map((i) => i.descripcion), ['VINILO IMPRESO + PRE CORTE X M2 (m2)', 'Colocación'])
    assert.equal(p.items[0].precio_unitario, 24181.82)
    assert.equal(p.items[1].unidad_medida, 'UN')
  })

  it('no arrastra número, CAE, fechas, período, venta, OP ni efectos contables', () => {
    const json = JSON.stringify(p)
    for (const prohibido of ['0014-00000692', '86440688442835', '2026-11-02', '2026-11-30', '2026-10-01', 'OP-1042', 'Autorizada', 'Emitida', '14044.8', 'id_venta']) {
      assert.ok(!json.includes(prohibido), `se coló ${prohibido}`)
    }
  })

  it('al volver a cargarla en el formulario da los mismos importes que la original, línea por línea', () => {
    for (const original of itemsFactura) {
      const copia = p.items.find((i) => i.descripcion === original.descripcion)!
      const linea = calcularLineaItem(copia, { preciosConIva: false })
      assert.deepEqual([linea.neto, linea.iva, linea.total], [original.subtotal, original.iva_monto, original.total], original.descripcion)
    }
    const totales = calcularTotalesFactura(p.items, { preciosConIva: false })
    assert.equal(totales.total, 15254.8)
    assert.equal(totales.iva, 2647.53)
  })

  it('las notas de crédito y de débito no se copian', () => {
    assert.equal(plantillaFactura({ ...facturaB, tipo_comprobante: 'Nota de Crédito B' }, itemsFactura), null)
    assert.equal(plantillaFactura({ ...facturaB, tipo_comprobante: 'Nota de Débito A' }, itemsFactura), null)
  })

  it('una factura de productos sin concepto vuelve como productos', () => {
    assert.equal(plantillaFactura({ ...facturaB, concepto: null }, itemsFactura)!.concepto, 1)
  })
})

const task = {
  id: 'orden-9',
  opNumber: 'OP-1042',
  title: 'Rodríguez Publicidad',
  dniCuit: '20-94205103-3',
  summary: 'Cartel luminoso 2x1',
  status: 'en-proceso',
  priority: 'alta',
  ownerId: 'u5',
  createdBy: 'Ana',
  tags: ['Urgente', 'Obra'],
  materials: ['Lona frontlight', 'Bastidor'],
  assignedSector: 'Taller Gráfico',
  sectores: ['Taller Gráfico', 'Instalaciones'],
  sectorInicial: 'Taller Gráfico',
  entregado: true,
  photoUrl: 'https://x/portada.png',
  createdAt: '2026-10-01',
  dueDate: '2026-10-20',
  estimatedTime: '15:30',
  marcadaPagada: true,
  montoPagoParcial: 5000,
  updatedAt: '2026-10-19',
  impact: 'alta',
  clientPhone: '264 555 0101',
  clientEmail: 'a@b.com',
  clientAddress: 'Calle Falsa 123',
  locationUrl: 'https://maps/x',
  driveUrl: 'https://drive/x',
  esDuplicado: true,
  idOrdenOriginal: 3,
  metrosCuadrados: 12.5,
  lineasMetrosM2: [{ id: 4, tipo: 'Lona', metrosCuadrados: 12.5 }],
  etapaTallerGrafico: 'Terminación',
  briefPublico: 'Brief',
  idPedidoCliente: 88,
  origenPedidoWeb: true
} as unknown as Task

describe('copiar una OP', () => {
  const p = plantillaOp(task, { prioridad: 'Alta', complejidad: 'Alta' })

  it('lleva el cliente y el trabajo', () => {
    assert.equal(p.cliente, 'Rodríguez Publicidad')
    assert.equal(p.dniCuit, '20-94205103-3')
    assert.equal(p.telefonoCliente, '264 555 0101')
    assert.equal(p.descripcion, 'Cartel luminoso 2x1')
    assert.deepEqual(p.selectedSectores, ['Taller Gráfico', 'Instalaciones'])
    assert.equal(p.prioridad, 'Alta')
    assert.equal(p.complejidad, 'Alta')
    assert.deepEqual(p.tags, ['Urgente', 'Obra'])
    assert.deepEqual(p.materials, [{ name: 'Lona frontlight', quantity: 1 }, { name: 'Bastidor', quantity: 1 }])
    assert.equal(p.metrosCuadrados, '12.5')
    assert.deepEqual(p.lineasMetrosM2, [{ tipo: 'Lona', metrosCuadrados: 12.5 }])
    assert.equal(p.briefPublico, 'Brief')
  })

  it('el número, la fecha, la hora, el cobro, la portada y los adjuntos quedan vacíos para cargarlos de nuevo', () => {
    assert.equal(p.opNumber, '')
    assert.equal(p.fechaEntrega, '')
    assert.equal(p.horaEstimada, '')
    assert.equal(p.cobroOp, 'ninguno')
    assert.equal(p.montoPagoParcialInput, '')
    assert.equal(p.photoUrl, '')
    assert.deepEqual(p.attachments, [])
    assert.equal(p.operario, '')
    assert.equal(p.pedidoWebSeleccionado, null)
    assert.equal(p.briefTokenSeleccionado, null)
  })

  it('no marca la copia como ficha duplicada ni la ata a otra OP (es un trabajo nuevo)', () => {
    const json = JSON.stringify(p)
    assert.ok(!/duplicad|ordenOriginal|OP-1042|Terminación|"id":/i.test(json))
  })

  it('una ficha de un solo sector toma ese sector', () => {
    const una = plantillaOp({ ...task, sectores: undefined, sectorInicial: 'Imprenta (Área de Impresión)' } as Task, { prioridad: 'Normal', complejidad: 'Media' })
    assert.deepEqual(una.selectedSectores, ['Imprenta (Área de Impresión)'])
  })
})

describe('copiar un pedido de compra', () => {
  const pedido = {
    id: 31,
    numero_pedido: 'PC-2026-0031',
    id_solicitante: 4,
    nombre_solicitante: 'Luis Gómez',
    sector_solicitante: 'Taller gráfico',
    id_proveedor: 12,
    estado: 'Completado',
    prioridad: 'Alta',
    motivo: 'Reposición de stock',
    observaciones: 'Entregar en el depósito.',
    fecha_solicitud: '2026-10-28',
    fecha_aprobacion: '2026-10-30',
    fecha_entrega_estimada: '2026-11-10',
    fecha_entrega_real: '2026-11-09',
    tracking_number: 'ABC123',
    nombre_aprobador: 'Marta Díaz',
    items: [
      { id: 1, id_pedido: 31, id_articulo_stock: 5, codigo_articulo: ' VIN-ROLLO ', descripcion: 'Rollo de vinilo', cantidad_solicitada: 10, cantidad_aprobada: 8, cantidad_comprada: 8, unidad: 'rollos', precio_unitario: 100000, observaciones: 'Blanco', created_at: '2026-10-28' },
      { id: 2, id_pedido: 31, descripcion: 'Tinta', cantidad_solicitada: 4, unidad: '', created_at: '2026-10-28' }
    ]
  } as unknown as PedidoCompra
  const p = plantillaPedidoCompra(pedido)

  it('lleva sector, proveedor, motivo, prioridad y lo que se pidió', () => {
    assert.equal(p.sector_solicitante, 'Taller gráfico')
    assert.equal(p.id_proveedor, 12)
    assert.equal(p.prioridad, 'Alta')
    assert.deepEqual(p.items[0], { id_articulo_stock: 5, codigo_articulo: 'VIN-ROLLO', descripcion: 'Rollo de vinilo', cantidad: 10, unidad: 'rollos', observaciones: 'Blanco' })
    assert.deepEqual(p.items[1], { codigo_articulo: '', descripcion: 'Tinta', cantidad: 4, unidad: 'unidad', observaciones: '' })
  })

  it('no arrastra número, estado, aprobación, seguimiento, fechas ni cantidades aprobadas o compradas', () => {
    const json = JSON.stringify(p)
    for (const prohibido of ['PC-2026-0031', 'Completado', 'Marta', 'ABC123', '2026-1', 'Luis', '100000', '"cantidad_aprobada']) {
      assert.ok(!json.includes(prohibido), `se coló ${prohibido}`)
    }
    assert.equal(p.items[0].cantidad, 10, 'se pide lo solicitado, no lo aprobado (8)')
  })
})

describe('copiar un presupuesto', () => {
  const presupuesto = {
    id: 42,
    id_cliente: 7,
    numero_presupuesto: 'PRE-2026-0042',
    estado: 'enviado',
    fecha_creacion: '2026-11-01',
    fecha_envio: '2026-11-01',
    fecha_respuesta: '2026-11-02',
    fecha_vencimiento: '2026-11-18',
    observaciones_cliente: 'Precios sujetos a disponibilidad.',
    observaciones_internas: '[precios_sin_iva] Lista: Lista 1 (Mostrador)  Cliente exigente',
    precio_total: 444750,
    id_op_asociada: 9,
    id_venta_asociada: 55,
    id_vendedor: 3,
    nombre_vendedor: 'Ana López',
    cliente_nombre: 'RODRIGUEZ ALBERTO RUBEN',
    cliente_telefono: '264 555 0101',
    cliente_email: 'alberto@example.com',
    cliente_dni_cuit: '20-94205103-3',
    cliente_empresa: 'Rodríguez Publicidad',
    cliente_direccion: 'Calle Falsa 123',
    tipo_lista_precio: 'lista_2',
    formas_pago: ['Efectivo', 'Transferencia']
  } as unknown as Parameters<typeof plantillaPresupuesto>[0]
  const items = [
    { id: 1, id_presupuesto: 42, id_articulo_stock: 31, codigo_articulo: 'VIN01', descripcion: 'Vinilo', cantidad: 12.5, precio_unitario: 29260, descuento: 500, precio_total: 365250, observaciones: 'Mate' },
    { id: 2, id_presupuesto: 42, descripcion: 'Colocación', cantidad: 1, precio_unitario: 25000, descuento: 0, precio_total: 25000 }
  ]
  const p = plantillaPresupuesto(presupuesto, items)

  it('lleva cliente, lista, formas de pago, observaciones y líneas', () => {
    assert.equal(p.cliente.nombre, 'RODRIGUEZ ALBERTO RUBEN')
    assert.equal(p.cliente.id_cliente, 7)
    assert.equal(p.tipo_lista, 'lista_2')
    assert.deepEqual(p.formas_pago, ['Efectivo', 'Transferencia'])
    assert.equal(p.observaciones_cliente, 'Precios sujetos a disponibilidad.')
    assert.deepEqual(p.items[0], { id_articulo_stock: 31, codigo_articulo: 'VIN01', descripcion: 'Vinilo', cantidad: 12.5, precio_unitario: 29260, descuento: 500, observaciones: 'Mate' })
  })

  it('la marca de "precios sin IVA" pasa como opción y no queda escrita en las notas internas', () => {
    assert.equal(p.sin_iva, true)
    assert.equal(p.observaciones_internas, 'Lista: Lista 1 (Mostrador) Cliente exigente')
    assert.equal(plantillaPresupuesto({ ...presupuesto, observaciones_internas: 'Con IVA' }, items).sin_iva, false)
  })

  it('no arrastra número, fechas, estado, vendedor ni vínculos con ventas u OP', () => {
    const json = JSON.stringify(p)
    for (const prohibido of ['PRE-2026-0042', '2026-11', 'enviado', 'Ana López', '444750', '"id_venta', 'id_op']) {
      assert.ok(!json.includes(prohibido), `se coló ${prohibido}`)
    }
  })

  it('sin lista definida usa la lista 1', () => {
    assert.equal(plantillaPresupuesto({ ...presupuesto, tipo_lista_precio: null }, items).tipo_lista, 'lista_1')
  })
})

describe('copiar un remito', () => {
  const remito: Remito = {
    id: 12, tipo: 'X', punto_venta: 1, numero: 12, estado: 'Emitido', id_venta: 55, numero_venta: 'V-55', id_op: 9, numero_op: 'OP-1042',
    cliente_nombre: 'Cliente', fecha_emision: '2026-11-03', fecha_entrega: '2026-11-04', entregado_a: ' Juan Pérez ', dni_retira: '30111222', transportista: 'Flete propio', observaciones: 'Llamar antes', usuario_nombre: 'Ana',
    items: [
      { orden: 1, id_venta_item: 1, descripcion: 'Cartel', cantidad: 4, cantidad_pedida: 10, cantidad_previa: 0 },
      { orden: 2, id_op_linea: 7, descripcion: 'Lona', unidad: 'm²', cantidad: 5.5, cantidad_pedida: 12.5, cantidad_previa: 0 },
      { orden: 3, descripcion: 'Muestra', cantidad: 2 }
    ]
  }
  const p = plantillaRemito(remito)

  it('lleva quién retira, el transporte, las observaciones y las cantidades, sin número ni fechas', () => {
    assert.deepEqual(p, {
      entregado_a: 'Juan Pérez',
      dni_retira: '30111222',
      transportista: 'Flete propio',
      observaciones: 'Llamar antes',
      items: [
        { id_venta_item: 1, descripcion: 'Cartel', cantidad: 4 },
        { id_op_linea: 7, descripcion: 'Lona', cantidad: 5.5 },
        { descripcion: 'Muestra', cantidad: 2 }
      ]
    })
    assert.ok(!JSON.stringify(p).includes('0001') && !JSON.stringify(p).includes('2026-11'))
  })

  const pendientes = (entregado: number) =>
    lineasDesdePendientes({
      venta_items: [{ id_venta_item: 1, descripcion: 'Cartel', pedida: 10, entregada: entregado, pendiente: 10 - entregado }],
      op_lineas: [{ id_op_linea: 7, descripcion: 'Lona', unidad: 'm²', pedida: 12.5, entregada: 5.5, pendiente: 7 }]
    })

  it('propone las mismas cantidades si todavía hay saldo', () => {
    const r = seleccionDesdeCopia(pendientes(4), p)
    assert.deepEqual(r.seleccion, { 'v:1': '4', 'o:7': '5.5' })
    assert.deepEqual(r.libres, [{ descripcion: 'Muestra', cantidad: '2' }])
    assert.deepEqual(r.omitidas, [])
  })

  it('nunca propone más de lo pendiente y avisa de lo que ya no queda', () => {
    const r = seleccionDesdeCopia(pendientes(8), p)
    assert.equal(r.seleccion['v:1'], '2', 'quedan 2 de 10')
    const sinSaldo = seleccionDesdeCopia(pendientes(10), p)
    assert.equal(sinSaldo.seleccion['v:1'], undefined)
    assert.deepEqual(sinSaldo.omitidas, ['Cartel'])
  })
})
