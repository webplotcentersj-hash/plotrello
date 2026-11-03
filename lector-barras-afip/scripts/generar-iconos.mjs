// Genera los íconos PNG de la PWA en public/. Uso: npm run iconos
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codificarPng } from './png.mjs'

const publico = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(publico, { recursive: true })

const FONDO = [11, 18, 32]
const BARRAS = [232, 237, 247]
const LINEA = [239, 68, 68]
// anchos alternados barra/espacio, en módulos
const PATRON = [1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2, 1, 1, 3, 1, 2]

/** `contenido` = fracción del lado que ocupa el dibujo (menor en el ícono "maskable" para respetar su zona segura). */
function dibujar(lado, contenido) {
  const px = new Uint8Array(lado * lado * 3)
  const rect = (x0, y0, x1, y1, color) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(lado, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(lado, Math.round(x1)); x++) px.set(color, (y * lado + x) * 3)
    }
  }
  rect(0, 0, lado, lado, FONDO)

  const ancho = lado * contenido
  const alto = ancho * 0.6
  const x0 = (lado - ancho) / 2
  const y0 = (lado - alto) / 2
  const total = PATRON.reduce((a, b) => a + b, 0)
  let x = x0
  PATRON.forEach((m, i) => {
    const w = (m / total) * ancho
    if (i % 2 === 0) rect(x, y0, x + w, y0 + alto, BARRAS)
    x += w
  })
  const grosor = Math.max(2, lado * 0.022)
  rect(x0 - lado * 0.04, lado / 2 - grosor / 2, x0 + ancho + lado * 0.04, lado / 2 + grosor / 2, LINEA)
  return px
}

const salidas = [
  ['icon-192.png', 192, 0.62],
  ['icon-512.png', 512, 0.62],
  ['icon-maskable-512.png', 512, 0.48],
  ['apple-touch-icon.png', 180, 0.62]
]
for (const [nombre, lado, contenido] of salidas) {
  writeFileSync(join(publico, nombre), codificarPng(lado, lado, dibujar(lado, contenido)))
  console.log('escrito', nombre)
}
