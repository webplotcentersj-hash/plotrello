import { test } from 'node:test'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import postcssGridMovil, { frSinDesborde, minmaxSeguro } from './postcssGridMovil'

const procesar = async (css: string) => (await postcss([postcssGridMovil()]).process(css, { from: 'x.css' })).css

test('minmax con mínimo fijo no supera el contenedor', () => {
  assert.equal(
    minmaxSeguro('repeat(auto-fit, minmax(360px, 1fr))'),
    'repeat(auto-fit, minmax(min(360px, 100%), 1fr))'
  )
  assert.equal(minmaxSeguro('minmax(12rem, 1fr) 2fr'), 'minmax(min(12rem, 100%), 1fr) 2fr')
  assert.equal(minmaxSeguro('minmax(0, 1fr)'), 'minmax(0, 1fr)')
})

test('fr sueltos pasan a minmax(0, fr) sin tocar los minmax existentes', () => {
  assert.equal(frSinDesborde('1fr'), 'minmax(0, 1fr)')
  assert.equal(frSinDesborde('1fr 1.2fr'), 'minmax(0, 1fr) minmax(0, 1.2fr)')
  assert.equal(frSinDesborde('repeat(2, 1fr)'), 'repeat(2, minmax(0, 1fr))')
  assert.equal(frSinDesborde('minmax(0, 1fr) auto'), 'minmax(0, 1fr) auto')
  assert.equal(frSinDesborde('64px 1fr'), '64px minmax(0, 1fr)')
  assert.equal(
    frSinDesborde('minmax(min(200px, 100%), 1fr) 1fr'),
    'minmax(min(200px, 100%), 1fr) minmax(0, 1fr)'
  )
})

test('solo convierte fr dentro de media queries mobile', async () => {
  const out = await procesar(
    '.a{grid-template-columns:1fr 1fr}@media (max-width: 768px){.a{grid-template-columns:1fr}}@media (max-width: 1400px){.b{grid-template-columns:1fr 2fr}}'
  )
  assert.match(out, /\.a\{grid-template-columns:1fr 1fr\}/)
  assert.match(out, /max-width: 768px\)\{\.a\{grid-template-columns:minmax\(0, 1fr\)\}/)
  assert.match(out, /\.b\{grid-template-columns:1fr 2fr\}/)
})

test('no toca otras propiedades', async () => {
  const out = await procesar('@media (max-width: 600px){.a{flex:1fr;width:360px}}')
  assert.doesNotMatch(out, /minmax/)
})
