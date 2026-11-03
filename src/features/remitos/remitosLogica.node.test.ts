import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cant3,
  esRemitoParcial,
  estadoEntrega,
  lineasDesdePendientes,
  numeroDeEntrega,
  numeroRemito,
  resumenRemitos,
  saldoTrasEntrega,
  seleccionTotal,
  validarSeleccion,
  type Remito
} from './remitosLogica.ts'

// Lo que devuelve remitos_pendientes: pedida / entregada / pendiente por línea (numeric llega como texto).
const rpc = (entregado: Record<string, number> = {}) => ({
  venta_items: [
    { id_venta_item: 1, codigo_articulo: 'A1', descripcion: 'Cartel 1x1', pedida: '10.000', entregada: String(entregado.v1 ?? 0), pendiente: String(10 - (entregado.v1 ?? 0)) },
    { id_venta_item: 2, codigo_articulo: 'B2', descripcion: 'Sticker', pedida: '5.000', entregada: String(entregado.v2 ?? 0), pendiente: String(5 - (entregado.v2 ?? 0)) }
  ],
  op_lineas: [{ id_op_linea: 7, descripcion: 'Lona frontlight', unidad: 'm²', pedida: '12.50', entregada: String(entregado.o7 ?? 0), pendiente: String(12.5 - (entregado.o7 ?? 0)) }]
})

let seq = 0
function remito(items: Array<{ v?: number; o?: number; cantidad: number }>, estado: Remito['estado'] = 'Emitido'): Remito {
  seq += 1
  return {
    id: seq,
    tipo: 'X',
    punto_venta: 1,
    numero: seq,
    estado,
    cliente_nombre: 'Cliente',
    fecha_emision: '2026-11-03',
    items: items.map((i, n) => ({
      orden: n + 1,
      id_venta_item: i.v ?? null,
      id_op_linea: i.o ?? null,
      descripcion: 'x',
      cantidad: i.cantidad
    }))
  }
}

describe('número de remito', () => {
  it('se imprime con punto de venta de 4 y número de 8 dígitos', () => {
    assert.equal(numeroRemito({ punto_venta: 1, numero: 12 }), '0001-00000012')
    assert.equal(numeroRemito({ punto_venta: 14, numero: 692 }), '0014-00000692')
  })
})

describe('cantidades', () => {
  it('quita el ruido del punto flotante', () => {
    assert.equal(cant3(0.1 + 0.2), 0.3)
    assert.equal(cant3(12.5 - 5.5), 7)
    assert.equal(cant3(1.0005), 1.001)
    assert.equal(cant3(NaN), 0)
  })
})

describe('pendientes', () => {
  it('convierte la respuesta de la base en líneas para la pantalla', () => {
    const p = lineasDesdePendientes(rpc())
    assert.deepEqual(p.map((l) => [l.clave, l.pedida, l.entregada, l.pendiente]), [
      ['v:1', 10, 0, 10],
      ['v:2', 5, 0, 5],
      ['o:7', 12.5, 0, 12.5]
    ])
    assert.equal(p[2].unidad, 'm²')
    assert.equal(estadoEntrega(p), 'Sin remitir')
  })

  it('sin respuesta no hay líneas', () => {
    assert.deepEqual(lineasDesdePendientes(null), [])
    assert.deepEqual(lineasDesdePendientes({ venta_items: null, op_lineas: null }), [])
    assert.equal(estadoEntrega([]), 'Sin líneas')
  })

  it('estado: parcial con algo entregado, completo con todo entregado', () => {
    assert.equal(estadoEntrega(lineasDesdePendientes(rpc({ v1: 4 }))), 'Entrega parcial')
    assert.equal(estadoEntrega(lineasDesdePendientes(rpc({ v1: 10, v2: 5, o7: 12.5 }))), 'Entregado completo')
  })

  it('las líneas ya completas no cuentan como pendientes de la selección', () => {
    const p = lineasDesdePendientes(rpc({ v1: 10 }))
    assert.deepEqual(seleccionTotal(p), { 'v:2': 5, 'o:7': 12.5 })
  })
})

describe('selección de la entrega', () => {
  const p = lineasDesdePendientes(rpc({ v1: 4 }))

  it('"entrega completa" propone todo lo pendiente', () => {
    assert.deepEqual(seleccionTotal(p), { 'v:1': 6, 'v:2': 5, 'o:7': 12.5 })
  })

  it('arma las líneas con cantidades válidas y descarta las vacías o en cero', () => {
    const r = validarSeleccion(p, { 'v:1': '2,5', 'v:2': 0, 'o:7': '' })
    assert.deepEqual(r.errores, [])
    assert.deepEqual(r.items, [
      { id_venta_item: 1, codigo_articulo: 'A1', descripcion: 'Cartel 1x1', unidad: null, cantidad: 2.5 }
    ])
  })

  it('no deja pasar lo pendiente ni cantidades inválidas', () => {
    const r = validarSeleccion(p, { 'v:1': 6.001, 'v:2': -1 })
    assert.equal(r.items.length, 0)
    assert.equal(r.errores.length, 2)
    assert.match(validarSeleccion(p, { 'v:1': 'abc' }).errores[0], /inválida/)
    assert.match(r.errores[0], /quedan 6 por remitir y cargaste 6.001/)
    assert.match(r.errores[1], /inválida/)
  })

  it('pide cargar algo si no hay ninguna línea', () => {
    assert.deepEqual(validarSeleccion(p, {}).errores, ['Cargá la cantidad de al menos una línea'])
  })

  it('las líneas de la OP salen en m² con su id', () => {
    const r = validarSeleccion(p, { 'o:7': 12.5 })
    assert.deepEqual(r.items, [{ id_op_linea: 7, codigo_articulo: null, descripcion: 'Lona frontlight', unidad: 'm²', cantidad: 12.5 }])
  })
})

describe('remito parcial', () => {
  it('es parcial si tras esta entrega queda saldo en alguna línea', () => {
    const r: Remito = {
      ...remito([]),
      items: [
        { orden: 1, id_venta_item: 1, descripcion: 'Cartel', cantidad: 4, cantidad_pedida: 10, cantidad_previa: 0 },
        { orden: 2, id_venta_item: 2, descripcion: 'Sticker', cantidad: 5, cantidad_pedida: 5, cantidad_previa: 0 }
      ]
    }
    assert.equal(saldoTrasEntrega(r.items[0]), 6)
    assert.equal(saldoTrasEntrega(r.items[1]), 0)
    assert.equal(esRemitoParcial(r), true)
  })

  it('el remito que completa el pedido no es parcial', () => {
    const r: Remito = { ...remito([]), items: [{ orden: 1, id_venta_item: 1, descripcion: 'Cartel', cantidad: 6, cantidad_pedida: 10, cantidad_previa: 4 }] }
    assert.equal(esRemitoParcial(r), false)
  })

  it('una línea libre no tiene saldo ni vuelve parcial al remito', () => {
    const r: Remito = { ...remito([]), items: [{ orden: 1, descripcion: 'Flete', cantidad: 1 }] }
    assert.equal(saldoTrasEntrega(r.items[0]), null)
    assert.equal(esRemitoParcial(r), false)
  })

  it('cuenta el número de entrega entre los remitos vigentes del mismo origen', () => {
    const a = remito([{ v: 1, cantidad: 1 }])
    const b = remito([{ v: 1, cantidad: 1 }], 'Anulado')
    const c = remito([{ v: 1, cantidad: 1 }])
    assert.equal(numeroDeEntrega(a, [a, b, c]), 1)
    assert.equal(numeroDeEntrega(c, [a, b, c]), 2)
    assert.deepEqual(resumenRemitos([a, b, c]), { emitidos: 2, anulados: 1 })
  })
})
