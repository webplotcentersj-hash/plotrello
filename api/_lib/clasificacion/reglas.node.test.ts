import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CATEGORIA_OTRO,
  CATEGORIA_SIN_COMENTARIO,
  clasificarPorRegla,
  construirOpcionesRubro,
  estadoParaIA,
  interpretarRespuesta,
  opcionesMotivoFalla,
  RUBROS_POR_DEFECTO,
  type Pendiente
} from './reglas.ts'

const pendiente = (p: Partial<Pendiente>): Pendiente => ({
  entidad_id: 1,
  texto: null,
  codigo: null,
  rating: null,
  contexto: null,
  rubro_catalogo: null,
  ...p
})

describe('reglas sin IA', () => {
  it('el rubro del catálogo gana y no pasa por la IA', () => {
    const c = clasificarPorRegla('rubro_venta_item', pendiente({ texto: 'Lona 2x1', rubro_catalogo: ' LONAS ' }))
    assert.deepEqual(c, { entidad_id: 1, categoria: 'LONAS', confianza: 1, fuente: 'catalogo', revisar: false })
  })

  it('ítem sin catálogo con texto → necesita IA', () => {
    assert.equal(clasificarPorRegla('rubro_venta_item', pendiente({ texto: 'Cartel 3x1 con estructura' })), null)
  })

  it('encuesta insatisfecha sin comentario → "Sin comentario"', () => {
    const c = clasificarPorRegla('motivo_falla_entrega', pendiente({ rating: 2, texto: '  ' }))
    assert.equal(c?.categoria, CATEGORIA_SIN_COMENTARIO)
    assert.equal(c?.fuente, 'regla')
  })
})

describe('opciones', () => {
  it('usa los rubros del catálogo con ejemplos y agrega Otro', () => {
    const o = construirOpcionesRubro([
      { categoria: 'LONAS', ejemplos: ['LONA FRONT', 'LONA BACK'] },
      { categoria: 'VINILOS', ejemplos: [] }
    ])
    assert.deepEqual(o, { LONAS: 'Ej.: LONA FRONT, LONA BACK', VINILOS: null, [CATEGORIA_OTRO]: 'No corresponde a ningún rubro anterior' })
  })

  it('sin catálogo usa la lista por defecto', () => {
    assert.deepEqual(construirOpcionesRubro([]), RUBROS_POR_DEFECTO)
  })
})

describe('datos que viajan a TypeSafe', () => {
  it('solo el texto necesario, sin datos del cliente', () => {
    const e = estadoParaIA('motivo_falla_entrega', pendiente({ rating: 2, texto: 'Llegó una semana tarde', contexto: 'Cartel frente local' }))
    assert.deepEqual(e, { calificacion: '2 de 5', comentario_cliente: 'Llegó una semana tarde', trabajo_realizado: 'Cartel frente local' })
  })
})

describe('interpretar respuesta', () => {
  const opciones = opcionesMotivoFalla()

  it('traduce la clave a la etiqueta', () => {
    const c = interpretarRespuesta('motivo_falla_entrega', 5, opciones, { choice: 'demora', confidence: 0.91 })
    assert.equal(c.categoria, 'Demora en la entrega')
    assert.equal(c.revisar, false)
  })

  it('confianza baja queda para revisar', () => {
    const c = interpretarRespuesta('motivo_falla_entrega', 5, opciones, { choice: 'precio', confidence: 0.41 })
    assert.equal(c.revisar, true)
  })

  it('opción inventada → Otro y revisar', () => {
    const c = interpretarRespuesta('rubro_venta_item', 5, { LONAS: null }, { choice: 'Pinturas', confidence: 0.99 })
    assert.equal(c.categoria, CATEGORIA_OTRO)
    assert.equal(c.revisar, true)
  })
})
