import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { efectivoObjetivoArqueoPlotLab, efectivoTeoricoDia } from './cajaMenuOperativaData.ts'
import { DIFERENCIA_CONTEO_MAX, cuadreArqueoConFondo } from './cierreTurno.ts'
import {
  type EventoFondo,
  eventosFondoDesdeArqueos,
  eventosFondoDesdeLotes,
  fondoInicialDelDia
} from './fondoInicial.ts'
import type { CajaArqueo, CajaMovimiento, CajaTransferenciaLote } from './types.ts'

const HOY = '2026-11-16'
const AYER = '2026-11-15'

function ev(p: Partial<EventoFondo>): EventoFondo {
  return { fecha: AYER, orden: '', origen: 'u-6', destino: 'u-6', monto: 0, ...p }
}

describe('fondoInicialDelDia', () => {
  it('el fondo que dejó la propia caja ayer arranca hoy en el cajón', () => {
    const f = fondoInicialDelDia({ cajaSlug: 'u-6', fecha: HOY, eventos: [ev({ monto: 1697 })] })
    assert.equal(f, 1697)
  })

  it('si ayer dejó el fondo en otra caja, la propia arranca en 0', () => {
    const f = fondoInicialDelDia({
      cajaSlug: 'u-6',
      fecha: HOY,
      eventos: [ev({ destino: 'u-31', monto: 5000 })],
      fondoConfigurado: 9999
    })
    assert.equal(f, 0)
  })

  it('suma lo que otra caja le dejó después del último cierre propio', () => {
    const f = fondoInicialDelDia({
      cajaSlug: 'u-6',
      fecha: HOY,
      eventos: [
        ev({ fecha: '2026-11-14', monto: 1000 }),
        ev({ fecha: AYER, origen: 'u-31', destino: 'u-6', monto: 2000 })
      ]
    })
    assert.equal(f, 3000)
  })

  it('ignora lo que otra caja le dejó ANTES del último cierre propio (ya se contó)', () => {
    const f = fondoInicialDelDia({
      cajaSlug: 'u-6',
      fecha: HOY,
      eventos: [
        ev({ fecha: '2026-11-13', origen: 'u-31', destino: 'u-6', monto: 2000 }),
        ev({ fecha: AYER, monto: 800 })
      ]
    })
    assert.equal(f, 800)
  })

  it('arqueo y cierre del mismo día informan un solo fondo (vale el último)', () => {
    const f = fondoInicialDelDia({
      cajaSlug: 'u-6',
      fecha: HOY,
      eventos: [
        ev({ orden: '2026-11-15T18:00:00Z', monto: 1500 }),
        ev({ orden: '2026-11-15T19:00:00Z', monto: 1200 })
      ]
    })
    assert.equal(f, 1200)
  })

  it('no usa eventos de hoy (los traspasos del día ya están en movimientos)', () => {
    const f = fondoInicialDelDia({ cajaSlug: 'u-6', fecha: HOY, eventos: [ev({ fecha: HOY, monto: 4000 })] })
    assert.equal(f, 0)
  })

  it('sin historial usa el fondo configurado en la caja', () => {
    assert.equal(fondoInicialDelDia({ cajaSlug: 'u-6', fecha: HOY, eventos: [], fondoConfigurado: 300 }), 300)
  })
})

describe('eventos de fondo desde arqueos y cierres', () => {
  it('lee el fondo dejado guardado en los saldos del arqueo', () => {
    const arq = {
      id: 'a1',
      fecha: AYER,
      caja_slug: 'u-6',
      turno: 'Único',
      billetes: {},
      total: 5000,
      saldos: { fondo_para_otra_caja: 1697, fondo_destino_slug: 'u-6' },
      created_at: '2026-11-15T20:00:00Z'
    } as CajaArqueo
    assert.deepEqual(eventosFondoDesdeArqueos([arq]), [
      { fecha: AYER, orden: '2026-11-15T20:00:00Z', origen: 'u-6', destino: 'u-6', monto: 1697 }
    ])
  })
  it('un arqueo viejo sin datos de fondo no inventa un evento', () => {
    const arq = { id: 'a2', fecha: AYER, caja_slug: 'u-6', turno: 'Único', billetes: {}, total: 1 } as CajaArqueo
    assert.deepEqual(eventosFondoDesdeArqueos([arq]), [])
  })
  it('lee el fondo de un cierre de turno', () => {
    const lote = {
      id: 'l1',
      fecha: AYER,
      origen_slug: 'u-31',
      caja_fondo_destino_slug: 'u-6',
      fondo_monto: 2500
    } as CajaTransferenciaLote
    assert.equal(eventosFondoDesdeLotes([lote])[0].monto, 2500)
  })
})

describe('objetivo del arqueo con fondo inicial', () => {
  const caja = { slug: 'u-6', fondo_fijo: 0 }
  const ventaEf: CajaMovimiento = {
    id: 'm1',
    fecha: HOY,
    concepto: 'Venta',
    origen_slug: 'cliente',
    destino_slug: 'u-6',
    tipo_movimiento: 'ingreso',
    efectivo: 10_000,
    otros: 0,
    monto_total: 10_000,
    origen_importacion: 'manual'
  } as CajaMovimiento

  it('suma el fondo con que arrancó el cajón', () => {
    assert.equal(efectivoTeoricoDia([ventaEf], HOY, caja, null, 1697), 11_697)
  })

  it('hay objetivo aunque no haya ventas en efectivo (antes daba null y no se controlaba)', () => {
    assert.equal(efectivoObjetivoArqueoPlotLab([], HOY, caja, null, 1697), 1697)
    assert.equal(
      efectivoObjetivoArqueoPlotLab([], HOY, caja, { count: 0, efectivo: 0, tarjetas: 0, transferencia: 0, ctaCte: 0, otros: 0, total: 0 }, 0),
      0
    )
  })

  it('contar el fondo inicial ya no da sobrante', () => {
    const objetivo = efectivoTeoricoDia([ventaEf], HOY, caja, null, 1697)
    const r = cuadreArqueoConFondo({ contado: 11_697, objetivo })
    assert.equal(r.cuadra, true)
    assert.equal(r.esSobrante, false)
  })
})

describe('umbral de justificación', () => {
  it('es $ 500', () => {
    assert.equal(DIFERENCIA_CONTEO_MAX, 500)
  })
  it('un faltante de $ 600 pide justificación', () => {
    const r = cuadreArqueoConFondo({ contado: 9_400, objetivo: 10_000 })
    assert.equal(r.esFaltante, true)
  })
  it('un faltante de $ 300 se absorbe como error de conteo', () => {
    const r = cuadreArqueoConFondo({ contado: 9_700, objetivo: 10_000 })
    assert.equal(r.esFaltante, false)
    assert.equal(r.faltanteAbsorbido, true)
  })
})
