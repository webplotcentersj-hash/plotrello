import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodificarLuminancia, decodificarRgba } from './decodificador.ts'

const CODIGO = '3071551880101001486406405514474202610167'

// Codificador ITF mínimo solo para armar imágenes de prueba ('1' = elemento ancho).
const PATRON = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010']

function anchosItf(digitos: string, ancho: number): number[] {
  const med = (c: string) => (c === '1' ? ancho : 1)
  const out = [1, 1, 1, 1]
  for (let i = 0; i < digitos.length; i += 2) {
    const barras = PATRON[Number(digitos[i])]
    const espacios = PATRON[Number(digitos[i + 1])]
    for (let j = 0; j < 5; j++) out.push(med(barras[j]), med(espacios[j]))
  }
  out.push(ancho, 1, 1)
  return out
}

type Opciones = { ancho?: number; px?: number; alto?: number; vertical?: boolean; ruido?: number }

function imagen(digitos: string, { ancho = 3, px = 3, alto = 60, vertical = false, ruido = 0 }: Opciones = {}) {
  const margen = 10
  const anchos = anchosItf(digitos, ancho)
  const modulos = anchos.reduce((a, b) => a + b, 0) + margen * 2
  const fila = new Uint8ClampedArray(modulos * px).fill(255)
  let x = margen
  anchos.forEach((a, i) => {
    if (i % 2 === 0) fila.fill(0, x * px, (x + a) * px)
    x += a
  })
  let w = fila.length
  let h = alto
  let lum = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) lum.set(fila, y * w)
  if (vertical) {
    const giro = new Uint8ClampedArray(w * h)
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) giro[xx * h + yy] = lum[yy * w + xx]
    lum = giro
    ;[w, h] = [h, w]
  }
  if (ruido) {
    let semilla = 12345
    const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1
    for (let i = 0; i < lum.length; i++) lum[i] = lum[i] + azar() * ruido
  }
  return { lum, w, h }
}

describe('decodificarLuminancia', () => {
  it('lee el código con relación 2 y 3 y varias resoluciones', () => {
    for (const ancho of [2, 3]) {
      for (const px of [2, 3, 4]) {
        const { lum, w, h } = imagen(CODIGO, { ancho, px })
        assert.equal(decodificarLuminancia(lum, w, h), CODIGO, `ancho ${ancho} px ${px}`)
      }
    }
  })

  it('lee el código girado 90°', () => {
    const { lum, w, h } = imagen(CODIGO, { vertical: true })
    assert.equal(decodificarLuminancia(lum, w, h), CODIGO)
  })

  it('tolera ruido de sensor de ±30 niveles por píxel', () => {
    const { lum, w, h } = imagen(CODIGO, { ruido: 30 })
    assert.equal(decodificarLuminancia(lum, w, h), CODIGO)
  })

  it('descarta ITF de otro largo (no es un código AFIP)', () => {
    for (const largo of [14, 38, 42]) {
      const { lum, w, h } = imagen('1234567890123456789012345678901234567890123456'.slice(0, largo))
      assert.equal(decodificarLuminancia(lum, w, h), null, `${largo} dígitos`)
    }
  })

  it('devuelve null si no hay código', () => {
    assert.equal(decodificarLuminancia(new Uint8ClampedArray(200 * 100).fill(255), 200, 100), null)
  })
})

describe('decodificarRgba', () => {
  it('convierte píxeles RGBA de un canvas y decodifica', () => {
    const { lum, w, h } = imagen(CODIGO)
    const rgba = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < lum.length; i++) rgba.set([lum[i], lum[i], lum[i], 255], i * 4)
    assert.equal(decodificarRgba(rgba, w, h), CODIGO)
  })
})
