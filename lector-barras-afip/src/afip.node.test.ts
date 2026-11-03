import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  analizarLectura,
  cuitValido,
  digitoVerificadorAfip,
  estadoVencimiento,
  formatearCuit,
  formatearFecha
} from './afip.ts'

const FACTURA_A = '3071551880101001486406405514474202610167'

function conDv(base39: string): string {
  return `${base39}${digitoVerificadorAfip(base39)}`
}

describe('digitoVerificadorAfip', () => {
  it('reproduce el ejemplo de la RG 1702 (01234567890 → 5)', () => {
    assert.equal(digitoVerificadorAfip('01234567890'), 5)
  })
})

describe('analizarLectura', () => {
  it('descompone una Factura A válida', () => {
    const l = analizarLectura(FACTURA_A)
    assert.equal(l.estado, 'valido')
    if (l.estado !== 'valido') return
    assert.deepEqual(l.datos, {
      cuit: '30715518801',
      tipoCodigo: '01',
      tipoNombre: 'Factura A',
      puntoVenta: '0014',
      cae: '86406405514474',
      vencimiento: '2026-10-16',
      vencimientoRaw: '20261016'
    })
    assert.deepEqual(l.avisos, [])
  })

  it('ignora espacios entre grupos al tipear', () => {
    const l = analizarLectura('30715518801 01 0014 86406405514474 20261016 7')
    assert.equal(l.estado, 'valido')
  })

  it('marca dígito verificador incorrecto y dice cuál esperaba', () => {
    const l = analizarLectura(`${FACTURA_A.slice(0, 39)}0`)
    assert.equal(l.estado, 'dv-incorrecto')
    if (l.estado === 'dv-incorrecto') assert.equal(l.dvEsperado, 7)
  })

  it('rechaza largo distinto de 40 y texto no numérico', () => {
    const corto = analizarLectura(FACTURA_A.slice(0, 38))
    assert.equal(corto.estado, 'no-afip')
    if (corto.estado === 'no-afip') assert.match(corto.motivo, /38 dígitos/)
    const letras = analizarLectura('30715518801AB')
    assert.equal(letras.estado, 'no-afip')
  })

  it('avisa de datos improbables aunque el dígito verificador cierre', () => {
    const cuitMalo = analizarLectura(conDv('30715518802' + '01' + '0014' + '86406405514474' + '20261016'))
    assert.equal(cuitMalo.estado, 'valido')
    if (cuitMalo.estado === 'valido') assert.match(cuitMalo.avisos.join(' '), /CUIT/)

    const fechaMala = analizarLectura(conDv('30715518801' + '01' + '0014' + '86406405514474' + '20261340'))
    assert.equal(fechaMala.estado, 'valido')
    if (fechaMala.estado === 'valido') {
      assert.equal(fechaMala.datos.vencimiento, null)
      assert.match(fechaMala.avisos.join(' '), /fecha/)
    }

    const tipoRaro = analizarLectura(conDv('30715518801' + '99' + '0014' + '86406405514474' + '20261016'))
    if (tipoRaro.estado === 'valido') assert.match(tipoRaro.avisos.join(' '), /99/)

    const pvCero = analizarLectura(conDv('30715518801' + '01' + '0000' + '86406405514474' + '20261016'))
    if (pvCero.estado === 'valido') assert.match(pvCero.avisos.join(' '), /0000/)
  })
})

describe('cuitValido / formatos', () => {
  it('valida el dígito verificador del CUIT', () => {
    assert.equal(cuitValido('30715518801'), true)
    assert.equal(cuitValido('30715518802'), false)
    assert.equal(cuitValido('3071551880'), false)
  })

  it('formatea CUIT y fecha', () => {
    assert.equal(formatearCuit('30715518801'), '30-71551880-1')
    assert.equal(formatearFecha('2026-10-16'), '16/10/2026')
  })
})

describe('estadoVencimiento', () => {
  const vto = '2026-10-16'

  it('vence hoy: vigente, 0 días', () => {
    assert.deepEqual(estadoVencimiento(vto, new Date(2026, 9, 16, 23, 59)), { vencido: false, dias: 0 })
  })

  it('un día después: vencido hace 1', () => {
    assert.deepEqual(estadoVencimiento(vto, new Date(2026, 9, 17, 0, 1)), { vencido: true, dias: -1 })
  })

  it('cuenta días de calendario entre meses y años', () => {
    assert.equal(estadoVencimiento(vto, new Date(2026, 9, 1)).dias, 15)
    assert.equal(estadoVencimiento('2027-01-02', new Date(2026, 11, 30)).dias, 3)
  })
})
