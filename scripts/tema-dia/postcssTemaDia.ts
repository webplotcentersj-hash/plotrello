/**
 * Plugin de PostCSS: genera el modo día de toda la app a partir del CSS oscuro.
 *
 * Por cada regla con colores, agrega justo después una copia que solo trae las
 * declaraciones de color convertidas, colgada de [data-tema='dia']:
 *
 *   .panel { background: #1f2233; color: #f9fbff; padding: 8px }
 *   [data-tema='dia'] .panel { background: #fbfcfe; color: #1e2230 }
 *
 * Al quedar pegada a la original y sumar siempre la misma especificidad, la
 * cascada entre reglas se conserva tal cual. Los ajustes finos a mano viven en
 * src/tema-dia.css con :root[data-tema='dia'] (una clase más de peso).
 */
import { Declaration as DeclarationCtor } from 'postcss'
import type { AtRule, ChildNode, Container, Declaration, Plugin, Rule } from 'postcss'
import {
  analizar,
  coloresDe,
  esFondoQueSostieneTexto,
  rolDeVariable,
  transformarValor,
  type RolColor
} from '../../src/utils/temaDiaColor'

const ATTR = "[data-tema='dia']"

const RE_VELO = /overlay|backdrop|scrim|lightbox|modal-bg|-velo\b|__velo/i
const RE_VAR_ACENTO =
  /var\(--[a-z0-9-]*(brand|accent|acento|primary|primario|gradient|success|danger|warning|error|naranja|orange)/i

/** Botones y similares: su variante "fantasma" suele heredar texto blanco de la base. */
const RE_CONTROL = /btn|button|boton|chip|pill|toggle|\btab\b|tab-|-tab\b/i

/** Variante tenue de un acento (--accent-soft, --brand-dim…): es un tinte, no sostiene texto blanco. */
const RE_VAR_TENUE = /soft|dim|tint|light|subtle|weak|bg|alpha|faint|suave|glow|line|ring|border|muted|hover-bg|fondo/i

function varDeAcentoSolido(valor: string): boolean {
  for (const m of valor.matchAll(/var\((--[a-z0-9-]+)/gi)) {
    if (RE_VAR_ACENTO.test('var(' + m[1]) && !RE_VAR_TENUE.test(m[1])) return true
  }
  return false
}

const PROPS_TEXTO = new Set([
  'color',
  '-webkit-text-fill-color',
  'caret-color',
  'text-decoration',
  'text-decoration-color',
  'text-emphasis-color',
  'fill',
  'stroke'
])
const PROPS_FONDO = new Set(['background', 'background-color', 'background-image'])
const PROPS_SOMBRA = new Set(['box-shadow', 'filter'])
/** Propiedades atajo que, al reescribirse, reinician sus longhands. */
const ATAJOS = new Set([
  'background',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-block',
  'border-inline',
  'outline',
  'text-decoration',
  'column-rule'
])

function rolDeProp(prop: string): RolColor | null {
  if (PROPS_TEXTO.has(prop)) return 'texto'
  if (PROPS_FONDO.has(prop)) return 'fondo'
  if (prop.startsWith('border') || prop.startsWith('outline') || prop.startsWith('column-rule'))
    return 'borde'
  if (PROPS_SOMBRA.has(prop)) return 'sombra'
  if (prop === 'text-shadow') return 'sombraTexto'
  return null
}

/** Prefija un selector con el atributo del tema. Devuelve null si no corresponde. */
export function selectorDia(sel: string): string | null {
  const s = sel.trim()
  if (!s || s.includes('data-tema')) return null
  if (/^:root\b/.test(s)) return `:root${ATTR}${s.slice(5)}`
  if (/^html\b/.test(s)) return `html${ATTR}${s.slice(4)}`
  return `${ATTR} ${s}`
}

function ancestros(rule: Rule): AtRule[] {
  const out: AtRule[] = []
  for (let p: Container | undefined = rule.parent as Container | undefined; p; p = p.parent as Container | undefined) {
    if (p.type === 'atrule') out.push(p as AtRule)
  }
  return out
}

function saltear(rule: Rule): boolean {
  return ancestros(rule).some((a) => {
    const n = a.name.toLowerCase()
    if (n.endsWith('keyframes') || n === 'font-face' || n === 'page') return true
    return n === 'media' && /\bprint\b/.test(a.params) && !/\bscreen\b/.test(a.params)
  })
}

function esDecl(n: ChildNode): n is Declaration {
  return n.type === 'decl'
}

function fondoSostieneTexto(rule: Rule): boolean {
  return rule.nodes.some(
    (d) =>
      esDecl(d) &&
      PROPS_FONDO.has(d.prop.toLowerCase()) &&
      (varDeAcentoSolido(d.value) || coloresDe(d.value).some(esFondoQueSostieneTexto))
  )
}

/** Selector sin pseudo-clases (:hover, :not(...)…) para emparentar estados con su regla base. */
export function selectorBase(sel: string): string {
  let s = sel.trim()
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(/:(?!:)[a-z-]+(\([^()]*\))?/gi, '')
  }
  return s.replace(/\s+/g, ' ').trim()
}

function tieneFondo(rule: Rule): boolean {
  return rule.nodes.some((d) => esDecl(d) && PROPS_FONDO.has(d.prop.toLowerCase()))
}

function convertirScrollbar(valor: string): string | null {
  const [pulgar, ...resto] = valor.trim().split(/\s+(?![^(]*\))/)
  const pista = resto.join(' ')
  const a = transformarValor(pulgar, 'borde')
  const b = pista ? transformarValor(pista, 'fondo') : null
  return a || b ? `${a ?? pulgar} ${b ?? pista}`.trim() : null
}

export default function postcssTemaDia(opciones: { incluir?: (archivo: string) => boolean } = {}): Plugin {
  const incluir = opciones.incluir ?? (() => true)
  return {
    postcssPlugin: 'plotlab-tema-dia',
    Once(root) {
      const archivo = (root.source?.input?.file ?? '').replace(/\\/g, '/')
      if (!incluir(archivo)) return

      // Selectores (sin estados) cuyo fondo es un acento sólido: sus :hover/:focus
      // que solo cambian el color de texto tampoco deben oscurecerlo.
      const conFondoAcento = new Set<string>()
      root.walkRules((rule) => {
        if (fondoSostieneTexto(rule)) rule.selectors.forEach((x) => conFondoAcento.add(selectorBase(x)))
      })

      root.walkRules((rule) => {
        if (rule.selector.includes('data-tema') || saltear(rule)) return

        const velo = RE_VELO.test(rule.selector)
        // Título con degradé recortado al texto: sus colores son letras, no fondo
        const degradeTexto = rule.nodes.some(
          (d) => esDecl(d) && /background-clip$/i.test(d.prop) && /text/i.test(d.value)
        )
        const mantenerTexto =
          !degradeTexto &&
          (fondoSostieneTexto(rule) ||
            (!tieneFondo(rule) && rule.selectors.every((x) => conFondoAcento.has(selectorBase(x)))))
        const decls: Declaration[] = []
        let fondoAclarado = false
        let tieneColor = false
        // Atajos (background, border…) ya reescritos: lo que la regla original fija
        // después de ellos (background-clip, border-left-width…) hay que repetirlo,
        // porque el atajo reescrito lo devolvería a su valor inicial.
        const familias: string[] = []
        const copiar = (d: Declaration, value = d.value) =>
          decls.push(d.clone({ value, raws: { before: '\n  ', between: ': ' } }))

        for (const d of rule.nodes) {
          if (!esDecl(d)) continue
          const prop = d.prop.toLowerCase()
          if (prop === 'color') tieneColor = true
          const reseteada = familias.some((f) => prop.replace(/^-webkit-/, '').startsWith(f + '-'))
          let nuevo: string | null
          if (prop === 'scrollbar-color') {
            nuevo = convertirScrollbar(d.value)
          } else {
            let rol = prop.startsWith('--') ? rolDeVariable(prop) : rolDeProp(prop)
            if (!rol || (rol === 'texto' && mantenerTexto)) {
              if (reseteada) copiar(d)
              continue
            }
            if (rol === 'fondo' && degradeTexto && PROPS_FONDO.has(prop)) rol = 'texto'
            else if (rol === 'fondo' && velo) rol = 'velo'
            nuevo = transformarValor(d.value, rol)
            if (nuevo != null && (rol === 'fondo' || rol === 'velo') && PROPS_FONDO.has(prop)) {
              fondoAclarado = coloresDe(nuevo).every((c) => analizar(c).L > 0.8 || c[3] < 0.3)
            }
          }
          if (nuevo == null) {
            if (reseteada) copiar(d)
            continue
          }
          copiar(d, nuevo)
          if (ATAJOS.has(prop)) familias.push(prop)
        }

        if (!decls.length) return
        // Variante de botón que pasa a fondo claro sin decir su color de texto:
        // el blanco heredado de la regla base quedaría invisible.
        const ultimo = rule.selectors.map((x) => x.trim().split(/\s+/).pop() ?? '').join(' ')
        if (fondoAclarado && !tieneColor && !mantenerTexto && RE_CONTROL.test(ultimo)) {
          decls.push(
            new DeclarationCtor({
              prop: 'color',
              value: 'var(--text-primary, #131829)',
              raws: { before: '\n  ', between: ': ' }
            })
          )
        }
        const selectores = rule.selectors.map(selectorDia).filter((s): s is string => Boolean(s))
        if (!selectores.length) return
        const copia = rule.clone()
        copia.removeAll()
        copia.selectors = selectores
        copia.raws.before = '\n'
        decls.forEach((d) => copia.append(d))
        rule.after(copia)
      })
    }
  }
}
postcssTemaDia.postcss = true
