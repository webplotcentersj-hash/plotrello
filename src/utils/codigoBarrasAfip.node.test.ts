import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  armarCodigoBarrasAfip,
  codigoBarrasItf,
  codigoBarrasItfSvg,
  digitoVerificadorAfip,
  leerCodigoBarrasAfip,
  validarCodigoBarrasAfip
} from './codigoBarrasAfip.ts'

const facturaA = {
  cuit: '30-71551880-1',
  tipoComprobante: 'Factura A',
  puntoVenta: 14,
  cae: '86406405514474',
  vencimiento: '2026-10-16'
}

describe('digitoVerificadorAfip', () => {
  it('reproduce el ejemplo de la RG 1702 (01234567890 → 5)', () => {
    assert.equal(digitoVerificadorAfip('01234567890'), 5)
  })

  it('devuelve 0 cuando el total ya es múltiplo de 10', () => {
    // impares 1+4=5 ×3=15, pares 4+1=5 → 20
    assert.equal(digitoVerificadorAfip('1441'), 0)
  })

  it('rechaza texto que no sea numérico', () => {
    assert.throws(() => digitoVerificadorAfip('12A4'))
  })
})

describe('armarCodigoBarrasAfip', () => {
  it('concatena CUIT, tipo, punto de venta, CAE, vencimiento y dígito verificador', () => {
    assert.equal(armarCodigoBarrasAfip(facturaA), '3071551880101001486406405514474202610167')
  })

  it('genera 40 dígitos y pasa su propia validación', () => {
    const codigo = armarCodigoBarrasAfip(facturaA)
    assert.equal(codigo.length, 40)
    assert.equal(validarCodigoBarrasAfip(codigo), true)
  })

  it('acepta tipo por código y fechas en otros formatos con el mismo resultado', () => {
    const esperado = armarCodigoBarrasAfip(facturaA)
    assert.equal(armarCodigoBarrasAfip({ ...facturaA, tipoComprobante: 1 }), esperado)
    assert.equal(armarCodigoBarrasAfip({ ...facturaA, tipoComprobante: '01' }), esperado)
    assert.equal(armarCodigoBarrasAfip({ ...facturaA, vencimiento: '20261016' }), esperado)
    assert.equal(armarCodigoBarrasAfip({ ...facturaA, vencimiento: '16/10/2026' }), esperado)
    assert.equal(armarCodigoBarrasAfip({ ...facturaA, vencimiento: new Date(2026, 9, 16) }), esperado)
  })

  it('arma una Factura C con CAI preimpreso', () => {
    const codigo = armarCodigoBarrasAfip({
      cuit: '20123456786',
      tipoComprobante: 'Factura C',
      puntoVenta: '0001',
      cae: '70000000000001',
      vencimiento: '2004-12-31'
    })
    assert.equal(codigo, '2012345678611000170000000000001200412314')
  })

  it('rechaza datos inválidos', () => {
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, cuit: '30715518802' }), /CUIT/)
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, tipoComprobante: 'Remito X' }), /Tipo de comprobante/)
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, puntoVenta: 0 }), /Punto de venta/)
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, puntoVenta: 10000 }), /Punto de venta/)
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, cae: '8640640551447' }), /14 dígitos/)
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, vencimiento: '2026-02-30' }), /no existe/)
    assert.throws(() => armarCodigoBarrasAfip({ ...facturaA, vencimiento: 'mañana' }), /ilegible/)
  })
})

describe('validarCodigoBarrasAfip / leerCodigoBarrasAfip', () => {
  const codigo = armarCodigoBarrasAfip(facturaA)

  it('detecta un dígito alterado o largo incorrecto', () => {
    const alterado = `${codigo.slice(0, 20)}${codigo[20] === '9' ? '0' : '9'}${codigo.slice(21)}`
    assert.equal(validarCodigoBarrasAfip(alterado), false)
    assert.equal(validarCodigoBarrasAfip(codigo.slice(1)), false)
    assert.equal(validarCodigoBarrasAfip(`${codigo.slice(0, 39)}x`), false)
  })

  it('descompone los campos', () => {
    assert.deepEqual(leerCodigoBarrasAfip(codigo), {
      cuit: '30715518801',
      tipoComprobante: '01',
      puntoVenta: 14,
      cae: '86406405514474',
      vencimiento: '2026-10-16'
    })
  })

  it('no lee un código con dígito verificador incorrecto', () => {
    assert.equal(leerCodigoBarrasAfip(`${codigo.slice(0, 39)}0`), null)
  })
})

describe('codigoBarrasItf', () => {
  // Decodificador independiente: anchos → dígitos.
  const PATRONES: Record<string, number> = {
    nnwwn: 0, wnnnw: 1, nwnnw: 2, wwnnn: 3, nnwnw: 4, wnwnn: 5, nwwnn: 6, nnnww: 7, wnnwn: 8, nwnwn: 9
  }
  function decodificar(anchos: number[], ancho: number): string {
    const umbral = (1 + ancho) / 2
    const letras = anchos.map((a) => (a > umbral ? 'w' : 'n'))
    assert.equal(letras.slice(0, 4).join(''), 'nnnn', 'inicio')
    assert.equal(letras.slice(-3).join(''), 'wnn', 'fin')
    const cuerpo = letras.slice(4, -3)
    let out = ''
    for (let i = 0; i < cuerpo.length; i += 10) {
      const par = cuerpo.slice(i, i + 10)
      const barras = par.filter((_, k) => k % 2 === 0).join('')
      const espacios = par.filter((_, k) => k % 2 === 1).join('')
      out += `${PATRONES[barras]}${PATRONES[espacios]}`
    }
    return out
  }

  it('codifica y decodifica de ida y vuelta los 40 dígitos', () => {
    const codigo = armarCodigoBarrasAfip(facturaA)
    for (const ancho of [2, 3]) {
      assert.equal(decodificar(codigoBarrasItf(codigo, ancho), ancho), codigo)
    }
  })

  it('tiene inicio (4), 10 elementos por cada par de dígitos y fin (3)', () => {
    const anchos = codigoBarrasItf(armarCodigoBarrasAfip(facturaA))
    assert.equal(anchos.length, 4 + 20 * 10 + 3)
    assert.equal(anchos.length % 2, 1, 'empieza y termina en barra')
  })

  it('rechaza cantidad impar de dígitos o texto', () => {
    assert.throws(() => codigoBarrasItf('123'))
    assert.throws(() => codigoBarrasItf('12ab'))
  })
})

describe('codigoBarrasItfSvg', () => {
  const svg = codigoBarrasItfSvg(armarCodigoBarrasAfip(facturaA))

  it('dibuja una barra por cada elemento par y deja zona de silencio de 8 módulos por lado', () => {
    // 207 elementos → 104 barras (+1 rect de fondo). Ancho: 4 + 40×9 + 5 = 369 módulos + 16 de silencio.
    assert.equal((svg.match(/<rect /g) ?? []).length, 104 + 1)
    assert.match(svg, /viewBox="0 0 385 /)
    assert.match(svg, /<rect x="8" y="0" width="1"/)
  })

  it('imprime el número legible debajo solo cuando se pide', () => {
    const codigo = armarCodigoBarrasAfip(facturaA)
    assert.doesNotMatch(svg, /<text/)
    const conTexto = codigoBarrasItfSvg(codigo, { conTexto: true })
    assert.match(conTexto, new RegExp(`<text[^>]*>${codigo}</text>`))
    assert.match(conTexto, /height="16\.6mm"/)
  })

  it('usa el módulo mínimo de la norma como tamaño real configurable', () => {
    const chico = codigoBarrasItfSvg('0123456789', { moduloMm: 0.191 })
    // 4 + 10 dígitos×9 + 5 = 99 módulos + 16 = 115 → 115 × 0,191 mm
    assert.match(chico, /width="21\.965mm"/)
  })
})
