/**
 * Plugin de PostCSS: grillas que no desbordan en el celular.
 *
 * 1) En todo el CSS, `minmax(360px, 1fr)` → `minmax(min(360px, 100%), 1fr)`.
 *    Con contenedor más ancho que 360px es idéntico; en un teléfono de 375px
 *    menos márgenes, la columna se achica en vez de empujar la pantalla.
 *
 * 2) Dentro de @media (max-width ≤ 1280px), las pistas `1fr` sueltas pasan a
 *    `minmax(0, 1fr)`. Un `1fr` crece hasta el ancho mínimo de su contenido
 *    (una tabla, un texto sin cortes) y estira toda la pantalla; en mobile
 *    nunca queremos eso.
 */
import type { AtRule, Container, Plugin } from 'postcss'

const PROPS = new Set(['grid-template-columns', 'grid-auto-columns', 'grid-template'])
const RE_MINMAX_FIJO = /minmax\(\s*(\d+(?:\.\d+)?(?:px|rem|em|ch))\s*,/g
/** `1fr`, `2fr`, `1.5fr` sueltos (no dentro de un minmax ya existente). */
const RE_FR_SUELTO = /(^|[\s,(])(\d*\.?\d+fr)(?=[\s,)]|$)/g

export function minmaxSeguro(valor: string): string {
  return valor.replace(RE_MINMAX_FIJO, (_m, len: string) => `minmax(min(${len}, 100%),`)
}

export function frSinDesborde(valor: string): string {
  // Protege los minmax(...) existentes para no anidar
  const guardados: string[] = []
  const sinMinmax = valor.replace(/minmax\((?:[^()]|\([^()]*\))*\)/g, (m) => {
    guardados.push(m)
    return `\u0000${guardados.length - 1}\u0000`
  })
  const convertido = sinMinmax.replace(RE_FR_SUELTO, (_m, pre: string, fr: string) => `${pre}minmax(0, ${fr})`)
  return convertido.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => guardados[Number(i)])
}

function enMediaMovil(nodo: Container | undefined): boolean {
  for (let p = nodo; p; p = p.parent as Container | undefined) {
    if (p.type === 'atrule' && (p as AtRule).name === 'media') {
      const m = /max-width:\s*(\d+)px/.exec((p as AtRule).params)
      if (m && Number(m[1]) <= 1280) return true
    }
  }
  return false
}

export default function postcssGridMovil(opciones: { incluir?: (archivo: string) => boolean } = {}): Plugin {
  const incluir = opciones.incluir ?? (() => true)
  return {
    postcssPlugin: 'plotlab-grid-movil',
    Once(root) {
      const archivo = (root.source?.input?.file ?? '').replace(/\\/g, '/')
      if (!incluir(archivo)) return
      root.walkDecls((d) => {
        if (!PROPS.has(d.prop.toLowerCase())) return
        let v = minmaxSeguro(d.value)
        if (enMediaMovil(d.parent as Container | undefined)) v = frSinDesborde(v)
        if (v !== d.value) d.value = v
      })
    }
  }
}
postcssGridMovil.postcss = true
