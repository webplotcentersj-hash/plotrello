import { test } from 'node:test'
import assert from 'node:assert/strict'
import postcss from 'postcss'
import postcssTemaDia, { selectorDia } from './postcssTemaDia'
import {
  analizar,
  bordeDia,
  fondoDia,
  formatear,
  parseColor,
  textoDia,
  type Rgba
} from '../../src/utils/temaDiaColor'

const procesar = async (css: string) => (await postcss([postcssTemaDia()]).process(css, { from: 'x.css' })).css
const c = (s: string) => parseColor(s) as Rgba
const L = (s: string) => analizar(c(s)).L

/** Contraste WCAG entre dos colores opacos. */
function contraste(a: Rgba, b: Rgba) {
  const lum = ([r, g, bb]: Rgba) => {
    const f = (v: number) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bb)
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

test('parsea hex, rgb con y sin coma, hsl y nombres', () => {
  assert.deepEqual(c('#fff'), [255, 255, 255, 1])
  assert.deepEqual(c('#00000080').map((v) => Math.round(v * 100) / 100), [0, 0, 0, 0.5])
  assert.deepEqual(c('rgba(15, 23, 42, 0.85)'), [15, 23, 42, 0.85])
  assert.deepEqual(c('rgb(15 23 42 / 50%)'), [15, 23, 42, 0.5])
  assert.deepEqual(c('white'), [255, 255, 255, 1])
  assert.equal(formatear(c('hsl(0, 0%, 100%)')), '#ffffff')
  assert.equal(parseColor('rgba(var(--x), 0.5)'), null)
})

test('superficies oscuras pasan a claras conservando el orden de elevación', () => {
  const base = fondoDia(c('#0e0f16'))
  const tarjeta = fondoDia(c('#1f2233'))
  assert.ok(analizar(base).L > 0.94)
  assert.ok(analizar(tarjeta).L > analizar(base).L, 'la tarjeta queda más clara que el fondo')
})

test('texto claro pasa a oscuro con contraste AA sobre blanco', () => {
  const blanco: Rgba = [255, 255, 255, 1]
  for (const t of ['#f9fbff', '#e2e8f0', '#b7bed3', '#94a3b8', '#93c5fd', '#fbbf24', '#34d399', '#fca5a5']) {
    const r = textoDia(c(t))
    assert.ok(contraste(r, blanco) >= 4.5, `${t} → ${formatear(r)} contraste ${contraste(r, blanco).toFixed(2)}`)
  }
})

test('la jerarquía de textos se conserva (primario más oscuro que apagado)', () => {
  const prim = analizar(textoDia(c('#f9fbff'))).L
  const sec = analizar(textoDia(c('#b7bed3'))).L
  const apag = analizar(textoDia(c('#7c84a0'))).L
  assert.ok(prim < sec && sec < apag)
})

test('colores de marca y acentos medios no se tocan como fondo', () => {
  assert.equal(formatear(fondoDia(c('#eb671b'))), '#eb671b')
  assert.equal(formatear(fondoDia(c('rgba(59, 130, 246, 0.15)'))), 'rgba(59, 130, 246, 0.15)')
})

test('texto oscuro (sobre papel o chip claro) queda igual', () => {
  assert.equal(formatear(textoDia(c('#111827'))), '#111827')
  assert.equal(formatear(fondoDia(c('#ffffff'))), '#ffffff')
})

test('bordes blancos translúcidos pasan a tinta translúcida visible', () => {
  const r = bordeDia(c('rgba(255, 255, 255, 0.08)'))
  assert.ok(analizar(r).L < 0.3 && r[3] >= 0.08)
})

test('el texto translúcido gana opacidad para seguir legible', () => {
  assert.ok(textoDia(c('rgba(255, 255, 255, 0.4)'))[3] > 0.55)
  assert.ok(L('#7c84a0') > 0)
})

test('genera la regla de día pegada a la original y solo con colores', async () => {
  const out = await procesar('.panel{background:#1f2233;color:#f9fbff;padding:8px}')
  assert.match(out, /\.panel\{background:#1f2233;color:#f9fbff;padding:8px\}\n\[data-tema='dia'\] \.panel\{/)
  assert.doesNotMatch(out.split("[data-tema='dia']")[1], /padding/)
})

test(':root y html llevan el atributo en el mismo elemento', () => {
  assert.equal(selectorDia(':root'), ":root[data-tema='dia']")
  assert.equal(selectorDia('html body'), "html[data-tema='dia'] body")
  assert.equal(selectorDia('.a > .b'), "[data-tema='dia'] .a > .b")
  assert.equal(selectorDia("[data-tema='dia'] .x"), null)
})

test('no toca keyframes, print ni url()', async () => {
  const out = await procesar(
    "@keyframes k{from{background:#000}}@media print{.x{color:#fff}}.i{background:url(\"data:image/svg+xml,%3Csvg fill='#fff'%3E\")}"
  )
  assert.doesNotMatch(out, /data-tema/)
})

test('texto blanco sobre fondo de acento en la misma regla se respeta', async () => {
  const out = await procesar('.btn{background:#eb671b;color:#fff}')
  assert.doesNotMatch(out, /data-tema/)
})

test('variante fantasma de botón recibe color de texto al aclararse', async () => {
  const out = await procesar(
    '.m-btn{background:linear-gradient(#3b82f6,#2563eb);color:#fff}.m-btn-ghost{background:rgba(255,255,255,0.08)}'
  )
  assert.match(out, /\[data-tema='dia'\] \.m-btn-ghost\{[^}]*color: var\(--text-primary/)
})

test('los fondos de modal (overlay) siguen oscureciendo', async () => {
  const out = await procesar('.modal-overlay{background:rgba(15,23,42,0.8)}')
  const valor = /\.modal-overlay\{\s*background: ([^;}]+)/.exec(out.split("[data-tema='dia']")[1])?.[1] ?? ''
  const col = c(valor.trim())
  assert.ok(analizar(col).L < 0.4 && col[3] >= 0.25, valor)
})

test('variables: texto, fondo y borde según el nombre', async () => {
  const out = await procesar(':root{--text-primary:#f9fbff;--surface-card:#1f2233;--surface-border:#2b2f43}')
  const dia = out.split("[data-tema='dia']")[1]
  const v = (n: string) => c(new RegExp(`${n}: ([^;}\\n]+)`).exec(dia)![1])
  assert.ok(analizar(v('--text-primary')).L < 0.35)
  assert.ok(analizar(v('--surface-card')).L > 0.95)
  const borde = analizar(v('--surface-border')).L
  assert.ok(borde > 0.75 && borde < 0.95)
})

test('pantallas ya claras (Cajas) no cambian: borde gris, tinta negra, fondo gris', async () => {
  const out = await procesar('.caja{--caja-ink:#000000;--caja-border:#b8bec8;--caja-bg:#c5cad4;color:var(--caja-ink)}')
  assert.doesNotMatch(out, /data-tema/)
})

test('títulos con degradé recortado al texto se oscurecen como letras', async () => {
  const out = await procesar(
    '.t{background:linear-gradient(90deg,#f8fafc,#99f6e4 55%,#7dd3fc);-webkit-background-clip:text;background-clip:text;color:transparent}'
  )
  const dia = out.split("[data-tema='dia']")[1]
  for (const tok of dia.match(/#[0-9a-f]{6}/g) ?? []) assert.ok(analizar(c(tok)).L < 0.6, tok)
})

test('fondo con variable de acento tenue no impide oscurecer el texto', async () => {
  const out = await procesar('.tab.is-active{color:#ecfdf5;background:var(--erp-accent-dim)}')
  assert.match(out, /\[data-tema='dia'\] \.tab\.is-active\{\s*color: #/)
  const solido = await procesar('.b{color:#fff;background:var(--brand)}')
  assert.doesNotMatch(solido, /data-tema/)
})

test('el :hover de un botón de acento conserva su texto blanco', async () => {
  const out = await procesar(
    '.pill--todos{color:#fff7ed;background:linear-gradient(135deg,rgba(234,88,12,0.85),rgba(251,146,60,0.75))}.pill--todos:hover:not(:disabled){color:#fff}'
  )
  assert.doesNotMatch(out, /data-tema/)
})

test('los longhands posteriores al atajo reescrito se repiten', async () => {
  const out = await procesar(
    '.t{background:linear-gradient(90deg,#a5b4fc,#93c5fd);-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.b{border:1px solid #2b2f43;border-left-width:4px;border-left-color:var(--acento);padding:4px}' +
      '.f{background:#1f2233 url(x.png) no-repeat;background-size:cover}'
  )
  const dia = (sel: string) => out.split(`[data-tema='dia'] ${sel}{`)[1]?.split('}')[0] ?? ''
  assert.match(dia('.t'), /-webkit-background-clip: text[\s\S]*background-clip: text/)
  assert.match(dia('.b'), /border-left-width: 4px[\s\S]*border-left-color: var\(--acento\)/)
  assert.doesNotMatch(dia('.b'), /padding/)
  assert.match(dia('.f'), /background-size: cover/)
})

test('fondo negro opaco se aclara y su texto claro se oscurece', async () => {
  const out = await procesar('.warn{background:#000;color:#fecaca}')
  const dia = out.split("[data-tema='dia']")[1]
  const fondo = c(/background: ([^;}\s]+)/.exec(dia)![1])
  const texto = c(/color: ([^;}\s]+)/.exec(dia)![1])
  assert.ok(analizar(fondo).L > 0.9 && analizar(texto).L < 0.6)
})

test('foto con velo negro translúcido conserva el texto blanco', async () => {
  const out = await procesar('.caption{background:rgba(0,0,0,0.6);color:#fff}')
  assert.doesNotMatch(out, /\[data-tema='dia'\][^}]*color/)
})
