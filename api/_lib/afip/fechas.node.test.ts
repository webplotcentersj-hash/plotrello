import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FacturaInvalidaError } from './errors.ts'
import {
  fechaComprobanteParaAfip,
  fechaEmisionAlineadaConUltimo,
  hoyArgentina,
  resolverFechasServicio
} from './fechas.ts'

describe('fecha del comprobante (validación 10016)', () => {
  const hoy = '2026-09-22'

  it('productos: hasta 5 días antes o después', () => {
    assert.equal(fechaComprobanteParaAfip('2026-09-17', 1, hoy), '2026-09-17')
    assert.equal(fechaComprobanteParaAfip('2026-09-16', 1, hoy), hoy)
    assert.equal(fechaComprobanteParaAfip('2026-09-27', 1, hoy), '2026-09-27')
    assert.equal(fechaComprobanteParaAfip('2026-09-28', 1, hoy), hoy)
  })

  it('productos: no puede pasar al mes siguiente', () => {
    assert.equal(fechaComprobanteParaAfip('2026-10-01', 1, '2026-09-29'), '2026-09-29')
    assert.equal(fechaComprobanteParaAfip('2026-09-30', 1, '2026-09-29'), '2026-09-30')
  })

  it('servicios: hasta 10 días antes o después', () => {
    assert.equal(fechaComprobanteParaAfip('2026-09-12', 2, hoy), '2026-09-12')
    assert.equal(fechaComprobanteParaAfip('2026-09-11', 3, hoy), hoy)
    assert.equal(fechaComprobanteParaAfip('2026-10-02', 2, hoy), '2026-10-02')
  })

  it('sin fecha usa hoy en Argentina (no UTC)', () => {
    assert.equal(fechaComprobanteParaAfip(null, 1, hoy), hoy)
    // 23:30 del 22/09 en Argentina = 02:30 UTC del 23/09
    assert.equal(hoyArgentina(new Date('2026-09-23T02:30:00Z')), '2026-09-22')
  })
})

describe('fecha alineada con último autorizado (10016 correlativo)', () => {
  const hoy = '2026-11-17'

  it('sube la fecha al último si la candidata es anterior', () => {
    assert.equal(fechaEmisionAlineadaConUltimo('2026-11-12', '2026-11-14', 1, hoy), '2026-11-14')
  })

  it('sin último conserva el clamp habitual', () => {
    assert.equal(fechaEmisionAlineadaConUltimo('2026-11-12', null, 1, hoy), '2026-11-12')
    assert.equal(fechaEmisionAlineadaConUltimo('2026-10-01', null, 1, hoy), hoy)
  })

  it('si alinear al último lo saca del margen AFIP, usa hoy', () => {
    // último muy futuro → max queda fuera de ±5 y el clamp vuelve a hoy
    assert.equal(fechaEmisionAlineadaConUltimo('2026-11-12', '2026-11-30', 1, hoy), hoy)
  })

  it('no retrocede si la candidata ya es posterior al último', () => {
    assert.equal(fechaEmisionAlineadaConUltimo('2026-11-16', '2026-11-14', 1, hoy), '2026-11-16')
  })
})

describe('período del servicio', () => {
  it('sin datos usa la fecha del comprobante', () => {
    assert.deepEqual(resolverFechasServicio({}, '2026-09-22'), {
      desde: '2026-09-22',
      hasta: '2026-09-22',
      vtoPago: '2026-09-22'
    })
  })

  it('el vencimiento del pago nunca es anterior a la fecha del comprobante', () => {
    const r = resolverFechasServicio(
      { fecha_servicio_desde: '2026-09-01', fecha_servicio_hasta: '2026-09-30', fecha_vencimiento: '2026-09-10' },
      '2026-09-22'
    )
    assert.deepEqual(r, { desde: '2026-09-01', hasta: '2026-09-30', vtoPago: '2026-09-22' })
  })

  it('rechaza desde posterior a hasta', () => {
    assert.throws(
      () => resolverFechasServicio({ fecha_servicio_desde: '2026-09-30', fecha_servicio_hasta: '2026-09-01' }, '2026-09-22'),
      FacturaInvalidaError
    )
  })
})
