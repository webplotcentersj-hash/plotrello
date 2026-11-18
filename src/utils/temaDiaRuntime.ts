/**
 * Modo día para los colores puestos inline desde React (style={{ color: '#fff' }})
 * y para los atributos fill/stroke de los SVG (gráficos de recharts).
 *
 * El CSS se convierte en el build (scripts/tema-dia/postcssTemaDia.ts), pero los
 * estilos inline no pasan por PostCSS. Mientras el modo día está activo, un
 * MutationObserver convierte esos colores con las mismas reglas y guarda el valor
 * original para devolverlo al volver al modo noche.
 *
 * Un elemento (y todo lo que tenga adentro) puede quedar afuera con
 * data-tema-fijo: vistas previas de impresión, fotos, etc.
 */
import {
  analizar,
  esFondoQueSostieneTexto,
  parseColor,
  rolDeVariable,
  transformarValor,
  type RolColor
} from './temaDiaColor'

const PROPS: Array<[string, RolColor]> = [
  ['color', 'texto'],
  ['-webkit-text-fill-color', 'texto'],
  ['caret-color', 'texto'],
  ['fill', 'texto'],
  ['stroke', 'texto'],
  ['background-color', 'fondo'],
  ['background-image', 'fondo'],
  ['border-top-color', 'borde'],
  ['border-right-color', 'borde'],
  ['border-bottom-color', 'borde'],
  ['border-left-color', 'borde'],
  ['outline-color', 'borde'],
  ['box-shadow', 'sombra'],
  ['text-shadow', 'sombraTexto']
]

const ATRIBUTOS_SVG = ['fill', 'stroke', 'stop-color']
const RE_VELO = /overlay|backdrop|scrim|lightbox|modal-bg|velo/i

type Registro = {
  /** valor original (modo noche) por propiedad / atributo */
  orig: Map<string, string>
  /** lo que escribimos nosotros, para reconocer nuestras propias mutaciones */
  escrito: Map<string, string>
}

const registros = new Map<Element, Registro>()
let observer: MutationObserver | null = null
let pendientes = new Set<Element>()
let programado = false

function registro(el: Element): Registro {
  let r = registros.get(el)
  if (!r) {
    r = { orig: new Map(), escrito: new Map() }
    registros.set(el, r)
  }
  return r
}

function fijo(el: Element): boolean {
  return el.closest('[data-tema-fijo]') != null
}

function sostieneTexto(el: HTMLElement): boolean {
  const c = parseColor(getComputedStyle(el).backgroundColor)
  return c != null && esFondoQueSostieneTexto(c)
}

function esFondoOscuroIntencional(el: HTMLElement): boolean {
  // Texto sobre una foto/imagen: se deja como está
  const bg = el.style.backgroundImage
  return Boolean(bg && bg.includes('url('))
}

function convertirEstilo(el: HTMLElement) {
  const st = el.style
  if (!st || st.length === 0) return
  const r = registros.get(el)
  const velo = RE_VELO.test(typeof el.className === 'string' ? el.className : '')
  let textoFijo: boolean | null = null

  const procesar = (prop: string, rol: RolColor) => {
    const actual = st.getPropertyValue(prop)
    const reg = r ?? registros.get(el)
    if (reg?.escrito.get(prop) === actual && actual !== '') return
    if (!actual) {
      reg?.orig.delete(prop)
      reg?.escrito.delete(prop)
      return
    }
    if (rol === 'texto') {
      if (textoFijo == null) textoFijo = esFondoOscuroIntencional(el) || sostieneTexto(el)
      if (textoFijo) return
    }
    const nuevo = transformarValor(actual, rol === 'fondo' && velo ? 'velo' : rol)
    const rr = registro(el)
    rr.orig.set(prop, actual)
    if (nuevo == null) {
      rr.escrito.delete(prop)
      return
    }
    st.setProperty(prop, nuevo, st.getPropertyPriority(prop))
    rr.escrito.set(prop, st.getPropertyValue(prop))
  }

  // Fondos primero: el texto mira el fondo ya convertido
  for (const [prop, rol] of PROPS) if (rol !== 'texto') procesar(prop, rol)
  for (const [prop, rol] of PROPS) if (rol === 'texto') procesar(prop, rol)
  for (let i = 0; i < st.length; i++) {
    const prop = st.item(i)
    if (prop.startsWith('--')) procesar(prop, rolDeVariable(prop))
  }
}

function convertirSvg(el: Element) {
  const tag = el.tagName.toLowerCase()
  const esTexto = tag === 'text' || tag === 'tspan'
  for (const attr of ATRIBUTOS_SVG) {
    const actual = el.getAttribute(attr)
    const reg = registros.get(el)
    if (actual == null) continue
    if (reg?.escrito.get('@' + attr) === actual) continue
    let rol: RolColor = esTexto ? 'texto' : attr === 'stroke' ? 'borde' : 'auto'
    // Barras/áreas de color de los gráficos: se respetan si no son grises
    if (!esTexto && attr !== 'stroke') {
      const c = parseColor(actual)
      if (c && !analizar(c).neutro) continue
      rol = 'fondo'
    }
    const nuevo = transformarValor(actual, rol)
    if (nuevo == null) continue
    const rr = registro(el)
    rr.orig.set('@' + attr, actual)
    el.setAttribute(attr, nuevo)
    rr.escrito.set('@' + attr, nuevo)
  }
}

function convertir(el: Element) {
  if (!el.isConnected || fijo(el)) return
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    if (el.getAttribute('style')) convertirEstilo(el as HTMLElement)
  }
  if (el instanceof SVGElement && ATRIBUTOS_SVG.some((a) => el.hasAttribute(a))) convertirSvg(el)
}

function convertirArbol(raiz: Element) {
  convertir(raiz)
  raiz.querySelectorAll('[style], svg [fill], svg [stroke], svg [stop-color]').forEach(convertir)
}

function vaciarPendientes() {
  programado = false
  const lote = pendientes
  pendientes = new Set()
  lote.forEach(convertirArbol)
}

function encolar(el: Element) {
  pendientes.add(el)
  if (!programado) {
    programado = true
    queueMicrotask(vaciarPendientes)
  }
}

function restaurarTodo() {
  registros.forEach((r, el) => {
    r.orig.forEach((valor, clave) => {
      if (clave.startsWith('@')) {
        const attr = clave.slice(1)
        if (el.getAttribute(attr) === r.escrito.get(clave)) el.setAttribute(attr, valor)
      } else {
        const st = (el as HTMLElement).style
        if (st && st.getPropertyValue(clave) === r.escrito.get(clave)) {
          st.setProperty(clave, valor, st.getPropertyPriority(clave))
        }
      }
    })
  })
  registros.clear()
}

function limpiarDesconectados() {
  registros.forEach((_r, el) => {
    if (!el.isConnected) registros.delete(el)
  })
}

export function activarTemaDiaInline() {
  if (observer || typeof MutationObserver === 'undefined') return
  convertirArbol(document.body)
  let mutaciones = 0
  observer = new MutationObserver((lista) => {
    for (const m of lista) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) encolar(n as Element)
        })
      } else if (m.target.nodeType === 1) {
        encolar(m.target as Element)
      }
    }
    mutaciones += lista.length
    if (mutaciones > 5000) {
      mutaciones = 0
      limpiarDesconectados()
    }
  })
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', ...ATRIBUTOS_SVG]
  })
}

export function desactivarTemaDiaInline() {
  observer?.disconnect()
  observer = null
  pendientes.clear()
  restaurarTodo()
}
