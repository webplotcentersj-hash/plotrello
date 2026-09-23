import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clasificarLote } from './clasificar.ts'

type Fila = Record<string, unknown>

/** Supabase falso: devuelve pendientes fijos y guarda lo que se upsertea. */
function supabaseFalso(pendientes: Fila[]) {
  const guardado: Fila[] = []
  const client = {
    rpc: async (fn: string) => {
      if (fn === 'clasificacion_ia_pendientes') return { data: pendientes, error: null }
      if (fn === 'clasificacion_ia_rubros_catalogo') {
        return { data: [{ categoria: 'LONAS', ejemplos: ['LONA FRONT'] }, { categoria: 'CARTELES', ejemplos: [] }], error: null }
      }
      throw new Error(`rpc inesperado ${fn}`)
    },
    from: () => ({
      upsert: async (rows: Fila[]) => {
        guardado.push(...rows)
        return { error: null }
      }
    })
  }
  return { client: client as unknown as SupabaseClient, guardado }
}

const fetchOriginal = globalThis.fetch
afterEach(() => {
  globalThis.fetch = fetchOriginal
  delete process.env.TYPESAFE_API_KEY
})

const deadline = () => Date.now() + 10_000

describe('clasificarLote', () => {
  it('sin clave: clasifica por catálogo y deja el resto pendiente', async () => {
    const { client, guardado } = supabaseFalso([
      { entidad_id: 1, texto: 'Lona', codigo: 'L1', rating: null, contexto: null, rubro_catalogo: 'LONAS' },
      { entidad_id: 2, texto: 'Cartel a medida', codigo: null, rating: null, contexto: null, rubro_catalogo: null }
    ])
    globalThis.fetch = (async () => {
      throw new Error('no debería llamar a la API')
    }) as typeof fetch

    const r = await clasificarLote(client, 'rubro_venta_item', { limite: 40, deadline: deadline() })
    assert.equal(r.sinClave, true)
    assert.deepEqual(r.clasificados, { catalogo: 1, regla: 0, ia: 0, revisar: 0 })
    assert.deepEqual(guardado.map((g) => [g.entidad_id, g.categoria, g.fuente]), [[1, 'LONAS', 'catalogo']])
  })

  it('con clave: manda solo la descripción y las opciones del catálogo', async () => {
    process.env.TYPESAFE_API_KEY = 'test'
    const { client, guardado } = supabaseFalso([
      { entidad_id: 2, texto: 'Cartel a medida', codigo: null, rating: null, contexto: null, rubro_catalogo: null }
    ])
    let pedido: any = null
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      pedido = JSON.parse(String(init.body))
      assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test')
      return new Response(
        JSON.stringify({ model: 'jev', answers: { clasificacion: { type: 'choice', choice: 'CARTELES', confidence: 0.88 } } }),
        { status: 200 }
      )
    }) as typeof fetch

    const r = await clasificarLote(client, 'rubro_venta_item', { limite: 40, deadline: deadline() })
    assert.deepEqual(pedido.state, { descripcion_item: 'Cartel a medida' })
    assert.equal(pedido.model, 'jev-latest')
    assert.deepEqual(Object.keys(pedido.questions.clasificacion.criteria).sort(), ['CARTELES', 'LONAS', 'Otro'])
    assert.equal(pedido.questions.clasificacion.type, 'choice')
    assert.deepEqual(r.clasificados, { catalogo: 0, regla: 0, ia: 1, revisar: 0 })
    assert.equal(guardado[0].categoria, 'CARTELES')
    assert.equal(guardado[0].fuente, 'ia')
  })

  it('clave inválida (401): corta sin reintentar y no guarda nada', async () => {
    process.env.TYPESAFE_API_KEY = 'mala'
    const { client, guardado } = supabaseFalso([
      { entidad_id: 3, texto: 'Llegó tarde', codigo: null, rating: 2, contexto: null, rubro_catalogo: null }
    ])
    let llamadas = 0
    globalThis.fetch = (async () => {
      llamadas += 1
      return new Response('unauthorized', { status: 401 })
    }) as typeof fetch

    const r = await clasificarLote(client, 'motivo_falla_entrega', { limite: 40, deadline: deadline() })
    assert.equal(llamadas, 1)
    assert.match(r.error || '', /401/)
    assert.equal(guardado.length, 0)
  })
})
