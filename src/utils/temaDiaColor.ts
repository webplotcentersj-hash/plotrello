/**
 * Conversión de colores del diseño oscuro (modo noche) a su par del modo día.
 *
 * La app se diseñó en oscuro con colores fijos en cientos de CSS. En lugar de
 * duplicar a mano cada regla, el plugin de PostCSS (scripts/tema-dia/postcssTemaDia.ts)
 * y el ajuste de estilos inline (temaDiaRuntime.ts) pasan cada color por estas funciones según el papel que cumple (fondo, texto, borde,
 * sombra). Todo se calcula en OKLab para que el brillo percibido sea parejo.
 */

// ---------- Parseo ----------

export type Rgba = [number, number, number, number]
export type RolColor = 'fondo' | 'velo' | 'texto' | 'borde' | 'sombra' | 'sombraTexto' | 'auto'

const NOMBRES: Record<string, Rgba> = {
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
  whitesmoke: [245, 245, 245, 1],
  gainsboro: [220, 220, 220, 1],
  silver: [192, 192, 192, 1],
  gray: [128, 128, 128, 1],
  grey: [128, 128, 128, 1],
  lightgray: [211, 211, 211, 1],
  lightgrey: [211, 211, 211, 1],
  darkgray: [169, 169, 169, 1],
  darkgrey: [169, 169, 169, 1]
}

/** Tokens de color dentro de un valor CSS (sin entrar en url()). */
export const RE_COLOR =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\([^()]*\)|\bhsla?\([^()]*\)|\b(?:white|black|whitesmoke|gainsboro|silver|gr[ae]y|light(?:gr[ae]y)|dark(?:gr[ae]y))\b/g

function num(s: string, escala: number): number {
  s = s.trim()
  if (s.endsWith('%')) return (parseFloat(s) / 100) * escala
  return parseFloat(s)
}

function partes(cuerpo: string): string[] {
  // Soporta "r, g, b, a" y "r g b / a"
  const [antes, alfa] = cuerpo.split('/')
  const p = antes.split(/[\s,]+/).filter(Boolean)
  if (alfa !== undefined) p.push(alfa.trim())
  return p
}

function hslARgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Devuelve [r,g,b,a] (0-255, a 0-1) o null si no se reconoce. */
export function parseColor(token: string): Rgba | null {
  const t = token.trim().toLowerCase()
  if (NOMBRES[t]) return [...NOMBRES[t]] as Rgba
  if (t.startsWith('#')) {
    let h = t.slice(1)
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  const m = /^(rgba?|hsla?)\((.*)\)$/.exec(t)
  if (!m) return null
  if (m[2].includes('var(') || m[2].includes('calc(')) return null
  const p = partes(m[2])
  if (p.length < 3) return null
  const a = p[3] !== undefined ? num(p[3], 1) : 1
  if (m[1].startsWith('rgb')) {
    const rgb = p.slice(0, 3).map((x) => num(x, 255))
    if (rgb.some(Number.isNaN) || Number.isNaN(a)) return null
    return [rgb[0], rgb[1], rgb[2], a]
  }
  const h = parseFloat(p[0])
  const s = num(p[1], 1) / (p[1].trim().endsWith('%') ? 1 : 100)
  const l = num(p[2], 1) / (p[2].trim().endsWith('%') ? 1 : 100)
  if ([h, s, l, a].some(Number.isNaN)) return null
  return [...hslARgb(h, s, l), a] as Rgba
}

// ---------- OKLab ----------

const lin = (c: number) => {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const delin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255

export function rgbAOklch([r, g, b]: Rgba): [number, number, number] {
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, Bb), Math.atan2(Bb, A)]
}

function oklchARgbCrudo(L: number, C: number, h: number): [number, number, number] {
  const A = C * Math.cos(h)
  const B = C * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    delin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    delin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    delin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ]
}

/** OKLCH → sRGB, bajando el croma hasta entrar en gama. */
export function oklchARgb(L: number, C: number, h: number): [number, number, number] {
  L = Math.max(0, Math.min(1, L))
  let c = C
  for (let i = 0; i < 24; i++) {
    const rgb = oklchARgbCrudo(L, c, h)
    if (rgb.every((v) => v >= -0.5 && v <= 255.5)) return rgb.map((v) => Math.max(0, Math.min(255, v))) as [number, number, number]
    c *= 0.85
  }
  return oklchARgbCrudo(L, 0, h).map((v) => Math.max(0, Math.min(255, v))) as [number, number, number]
}

// ---------- Salida ----------

const r2 = (n: number) => Math.round(n * 1000) / 1000

export function formatear([r, g, b, a]: Rgba): string {
  const R = Math.round(r)
  const G = Math.round(g)
  const B = Math.round(b)
  if (a >= 0.999) {
    return '#' + [R, G, B].map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  return `rgba(${R}, ${G}, ${B}, ${r2(Math.max(0, a))})`
}

// ---------- Clasificación ----------

/** Tinta neutra del modo día (slate-900): base de velos, bordes y sombras. */
const TINTA: [number, number, number] = [15, 23, 42]
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function analizar(rgba: Rgba) {
  const [L, C, h] = rgbAOklch(rgba)
  const a = rgba[3]
  const neutro = C < 0.055
  const negroPuro = rgba[0] < 8 && rgba[1] < 8 && rgba[2] < 8
  return { L, C, h, a, neutro, negroPuro }
}

function desdeOklch(L: number, C: number, h: number, a: number): Rgba {
  return [...oklchARgb(L, C, h), a]
}

// --- Fondos ---
export function fondoDia(rgba: Rgba, { esVelo = false }: { esVelo?: boolean } = {}): Rgba {
  const { L, C, h, a, neutro, negroPuro } = analizar(rgba)
  if (a === 0) return rgba
  if (neutro) {
    // Velo blanco translúcido (realce de tarjetas en oscuro) → velo de tinta
    if (L > 0.85 && a < 0.95) return [...TINTA, clamp(a * 0.6, 0.02, 0.14)]
    // Negro puro translúcido: fondos de modal / degradés sobre fotos → se respeta
    if (negroPuro && a < 0.999) {
      if (a >= 0.4 || esVelo) return [rgba[0], rgba[1], rgba[2], esVelo ? Math.min(a, 0.55) : a]
      return [...TINTA, r2(a * 0.25)]
    }
    if (esVelo && L < 0.4) return [...TINTA, clamp(a * 0.6, 0.25, 0.55)]
    // Superficie oscura → superficie clara, respetando el orden de elevación
    if (L < 0.55) {
      const L2 = clamp(0.945 + (L - 0.12) * 0.3, 0.94, 1)
      return desdeOklch(L2, Math.min(C * 0.5, 0.008), h, a)
    }
    return rgba
  }
  // Cromático oscuro (paneles teñidos: rojo error, azul info…) → tinte claro
  if (L < 0.45) {
    if (a < 0.6) return desdeOklch(0.55, C, h, clamp(a * 0.7, 0.04, 0.3))
    return desdeOklch(0.955, Math.min(C * 0.45, 0.045), h, a)
  }
  return rgba
}

// --- Textos ---
export function textoDia(rgba: Rgba): Rgba {
  const { L, C, h, a, neutro } = analizar(rgba)
  if (a === 0) return rgba
  if (neutro) {
    if (L < 0.5) return rgba
    // Grises medios (#666) ya se leen sobre claro: nunca se aclaran
    const L2 = Math.min(L, 0.21 + (1 - L) * 0.85)
    // Blanco translúcido como texto apagado: sobre claro hace falta más opacidad
    const a2 = a < 0.999 ? clamp(a * 1.15 + 0.15, 0, 1) : a
    return desdeOklch(L2, Math.min(C * 0.8, 0.03), h, a2)
  }
  if (L <= 0.6) return rgba
  const L2 = 0.62 - (L - 0.6) * 0.45
  return desdeOklch(L2, C, h, a)
}

// --- Bordes ---
export function bordeDia(rgba: Rgba): Rgba {
  const { L, C, h, a, neutro, negroPuro } = analizar(rgba)
  if (a === 0) return rgba
  if (neutro) {
    if (L > 0.85 && a < 0.95) return [...TINTA, clamp(a * 1.3, 0.08, 0.6)]
    if (negroPuro && a < 0.999) return [...TINTA, clamp(a * 0.5, 0.06, 0.4)]
    if (L < 0.55) {
      const L2 = clamp(0.95 - L * 0.4, 0.78, 0.93)
      return desdeOklch(L2, Math.min(C * 0.7, 0.02), h, a)
    }
    // Gris claro opaco: o es una pantalla ya clara (Cajas) o un aro blanco; se respeta
    return rgba
  }
  if (L < 0.45) return desdeOklch(0.84, Math.min(C * 0.7, 0.08), h, a)
  return rgba
}

// --- Sombras ---
export function sombraDia(rgba: Rgba): Rgba {
  const { L, a, neutro } = analizar(rgba)
  if (a === 0) return rgba
  if (neutro && L < 0.4) return [...TINTA, r2(clamp(a * 0.3, 0.03, 0.16))]
  if (neutro && L > 0.85) return rgba
  return [rgba[0], rgba[1], rgba[2], r2(a * 0.6)]
}

export function sombraTextoDia(rgba: Rgba): Rgba {
  const { L, a, neutro } = analizar(rgba)
  if (neutro && L < 0.4) return [...TINTA, 0]
  if (neutro && L > 0.85) return [255, 255, 255, 0]
  return [rgba[0], rgba[1], rgba[2], r2(a * 0.4)]
}

/** Para variables CSS sin pista en el nombre: decide por el color. */
export function autoDia(rgba: Rgba): Rgba {
  const { L, a, neutro } = analizar(rgba)
  if (neutro) {
    if (L > 0.85 && a < 0.5) return fondoDia(rgba)
    if (L >= 0.55) return textoDia(rgba)
    return fondoDia(rgba)
  }
  if (L > 0.65) return textoDia(rgba)
  if (L < 0.45) return fondoDia(rgba)
  return rgba
}

/** ¿Es un fondo "de acento" (botón naranja, badge de color) o uno oscuro a propósito? */
export function esFondoQueSostieneTexto(rgba: Rgba): boolean {
  const { L, C, a, neutro } = analizar(rgba)
  if (a < 0.55) return false
  // Tiene que ser un fondo que el modo día deja igual: si se aclara, el texto también cambia
  if (formatear(fondoDia(rgba)) !== formatear(rgba)) return false
  return (!neutro && C >= 0.07 && L >= 0.45) || L < 0.3
}

export const TRANSFORMADORES: Record<RolColor, (c: Rgba) => Rgba> = {
  fondo: fondoDia,
  velo: (c: Rgba) => fondoDia(c, { esVelo: true }),
  texto: textoDia,
  borde: bordeDia,
  sombra: sombraDia,
  sombraTexto: sombraTextoDia,
  auto: autoDia
}

/** Rol de una variable CSS (--algo) según su nombre. */
export function rolDeVariable(nombre: string): RolColor {
  const n = nombre.toLowerCase()
  if (/shadow|sombra|glow/.test(n)) return 'sombra'
  if (/border|borde|line|linea|divider|stroke|outline|ring|separador/.test(n)) return 'borde'
  if (/overlay|backdrop|scrim|velo/.test(n)) return 'velo'
  if (/(^--|-)(text|txt|fg|ink|foreground|muted|label|title|titulo|heading|texto|tinta)(-|$)/.test(n))
    return 'texto'
  if (/bg|surface|superficie|fondo|background|panel|card|tarjeta|base|layer|elev|chip|input|hover/.test(n))
    return 'fondo'
  return 'auto'
}

/** Reemplaza cada color del valor (fuera de url()) con el transformador dado. */
export function transformarValor(valor: string, rol: RolColor): string | null {
  const fn = TRANSFORMADORES[rol]
  let cambio = false
  const trozos = valor.split(/(url\([^)]*\))/i)
  const salida = trozos
    .map((trozo) => {
      if (/^url\(/i.test(trozo)) return trozo
      return trozo.replace(RE_COLOR, (tok) => {
        const rgba = parseColor(tok)
        if (!rgba) return tok
        const nuevo = formatear(fn(rgba))
        if (nuevo.toLowerCase() === formatear(rgba).toLowerCase()) return tok
        cambio = true
        return nuevo
      })
    })
    .join('')
  return cambio ? salida : null
}

/** Colores de un valor (para decidir si un fondo sostiene texto claro). */
export function coloresDe(valor: string): Rgba[] {
  const out: Rgba[] = []
  for (const trozo of valor.split(/(url\([^)]*\))/i)) {
    if (/^url\(/i.test(trozo)) continue
    for (const tok of trozo.match(RE_COLOR) ?? []) {
      const c = parseColor(tok)
      if (c) out.push(c)
    }
  }
  return out
}
