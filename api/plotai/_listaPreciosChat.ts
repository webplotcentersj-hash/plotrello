import type { SupabaseClient } from '@supabase/supabase-js'

type ConfigAjustesPreciosVentas = {
  iva_porcentaje: number
  iva_activo: boolean
  recargos: Array<{ id: string; nombre: string; porcentaje: number; activo: boolean }>
}

type ArticuloPrecioRow = {
  codigo: string | null
  nombre: string | null
  descripcion?: string | null
  categoria?: string | null
  precio_base?: number | null
  precio_lista_1?: number | null
}

const DEFAULT_AJUSTES: ConfigAjustesPreciosVentas = {
  iva_porcentaje: 21,
  iva_activo: true,
  recargos: []
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function resolvePrecioLista1Bruto(articulo: ArticuloPrecioRow): number | null {
  const v = articulo.precio_lista_1 ?? articulo.precio_base
  if (v == null || !Number.isFinite(Number(v)) || Number(v) < 0) return null
  return Number(v)
}

function calcularPrecioFinalLista1(
  bruto: number,
  config: ConfigAjustesPreciosVentas = DEFAULT_AJUSTES
): number {
  let totalPorcentaje = 0
  if (config.iva_activo && config.iva_porcentaje > 0) totalPorcentaje += config.iva_porcentaje
  for (const r of config.recargos) {
    if (r.activo && r.porcentaje > 0) totalPorcentaje += r.porcentaje
  }
  return round2(bruto * (1 + totalPorcentaje / 100))
}

function normalizarConfigAjustes(raw: unknown): ConfigAjustesPreciosVentas {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AJUSTES, recargos: [] }
  const o = raw as Record<string, unknown>
  const recargos = Array.isArray(o.recargos)
    ? o.recargos
        .map((r, i) => {
          const item = r as Record<string, unknown>
          return {
            id: String(item?.id || `recargo-${i}`),
            nombre: String(item?.nombre || 'Recargo').trim() || 'Recargo',
            porcentaje: Math.max(0, Number(item?.porcentaje) || 0),
            activo: item?.activo !== false
          }
        })
        .filter((r) => r.nombre)
    : []
  return {
    iva_porcentaje: Math.max(0, Number(o.iva_porcentaje ?? 21) || 0),
    iva_activo: o.iva_activo !== false,
    recargos
  }
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

function formatArs(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STOP_WORDS = new Set([
  'precio',
  'precios',
  'cuanto',
  'cuánto',
  'sale',
  'cuesta',
  'cuestan',
  'cotizar',
  'cotizacion',
  'cotización',
  'cotizame',
  'cotizá',
  'lista',
  'valor',
  'tarifa',
  'quiero',
  'necesito',
  'necesitamos',
  'por',
  'una',
  'unos',
  'unas',
  'un',
  'el',
  'la',
  'los',
  'las',
  'de',
  'del',
  'me',
  'te',
  'hay',
  'tienen',
  'tiene',
  'cuanto',
  'cuánto',
  'saber',
  'decime',
  'decirme',
  'podrian',
  'podrían',
  'podés',
  'podes',
  'puede',
  'cuanto',
  'esta',
  'está',
  'estan',
  'están',
  'hacer',
  'hacen',
  'para',
  'con',
  'sin',
  'mas',
  'más',
  'menos',
  'algo',
  'algun',
  'algún',
  'alguna',
  'gustaria',
  'gustaría',
  'quisiera',
  'busco',
  'solicito',
  'encargar',
  'encargo',
  'imprimir',
  'impresion',
  'impresión',
  'pedir',
  'pedido',
  'hacen',
  'haces',
  'hacés',
  'fabrican',
  'imprimen',
  'realizan',
  'unidades',
  'unidad'
])

const PRODUCTO_KEYWORDS = [
  'sticker',
  'stickers',
  'tarjeta',
  'tarjetas',
  'folleto',
  'folletos',
  'cartel',
  'carteles',
  'banner',
  'banners',
  'vinilo',
  'vinilos',
  'afiche',
  'afiches',
  'volante',
  'volantes',
  'talonario',
  'talonarios',
  'catalogo',
  'catálogo',
  'catalogos',
  'catálogos',
  'impresion',
  'impresión',
  'impresiones',
  'plotter',
  'lona',
  'lonas',
  'gigantografia',
  'gigantografía',
  'buzonera',
  'buzón',
  'flyer',
  'flyers',
  'triptico',
  'tríptico',
  'pendon',
  'pendón',
  'rollup',
  'roll up',
  'rotulo',
  'rótulo',
  'senal',
  'señal',
  'etiqueta',
  'etiquetas',
  'packaging',
  'pack',
  'logo',
  'stickers',
  'calcomania',
  'calcomanía',
  'plotear',
  'plotear',
  'plotteo',
  'plotteado'
]

/** Consulta de estado de OP/pedido existente — no cargar lista de precios. */
function esConsultaEstadoPedido(text: string): boolean {
  return /\b(op\s*\d|orden\s+de\s+trabajo|estado\s+de|como\s+va|c[oó]mo\s+va|c[oó]mo\s+and[aá]|d[oó]nde\s+est[aá]|mi\s+pedido|mi\s+trabajo|hablar\s+con|retir(ar|o)|listo\s+para)\b/i.test(
    text
  )
}

/** Detecta si el visitante pregunta por precios o cotización. */
export function detectConsultaPrecios(text: string): boolean {
  const t = text.toLowerCase()
  if (!t.trim()) return false
  const patterns = [
    /\b(precio|precios|tarifa|tarifas|cotizaci[oó]n|cotizar|cotizame|cotizá)\b/i,
    /\b(cu[aá]nto\s+(sale|cuesta|cuestan|vale|valen|es|ser[ií]a))\b/i,
    /\b(qu[eé]\s+precio|a\s+cu[aá]nto|valor\s+de|lista\s+de\s+precios?)\b/i,
    /\b(cuesta|sale)\s+(el|la|los|las|un|una)\b/i,
    /\$\s*\d/
  ]
  return patterns.some((re) => re.test(t))
}

/** Detecta pedido nuevo o consulta por producto sin mencionar "precio". */
export function detectIntencionPedidoProducto(text: string): boolean {
  const t = text.toLowerCase().trim()
  if (!t || t.length < 8) return false

  const mencionaProducto = PRODUCTO_KEYWORDS.some((k) => t.includes(k))
  const cantidadYProducto = /\b\d+\s+(?:unidades?\s+de\s+)?[a-záéíóúñ]{4,}/i.test(t)

  const intencionCompra = [
    /\b(quiero|necesito|necesitamos|busco|solicito|pedir[ií]|encargar|encargo)\s+/i,
    /\b(me\s+gustar[ií]a|quisiera)\s+/i,
    /\b(hacen|hac[eé]s|pueden\s+hacer|puedo\s+pedir|fabrican|imprimen|realizan)\s+/i,
    /\b(?:imprimir|impresi[oó]n\s+de)\s+/i,
    /\bpedido\s+(?:de|nuevo)\s+/i
  ].some((re) => re.test(t))

  if (!mencionaProducto && !cantidadYProducto) return false
  if (!intencionCompra && !cantidadYProducto) {
    return /\b(quiero|necesito|pedir|hacer|imprimir|encargar)\b/i.test(t) && mencionaProducto
  }

  if (esConsultaEstadoPedido(t) && !intencionCompra) return false

  return true
}

/** ¿Cargar catálogo Lista 1 en el prompt? */
export function shouldLoadLista1PreciosContext(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (detectConsultaPrecios(t)) return true
  if (detectIntencionPedidoProducto(t)) return true
  return false
}

/** Cantidad numérica que menciona el cliente (ej. 500 stickers). */
export function extractCantidadSolicitada(text: string): number | null {
  const m = text.match(/\b(\d{1,6})\s+(?:unidades?\s+de\s+)?(?:stickers?|tarjetas?|folletos?|carteles?|afiches?|volantes?|banners?|vinilos?|hojas?|talonarios?)/i)
  if (m) return Number(m[1])
  const m2 = text.match(/\b(?:quiero|necesito|pedir)\s+(\d{1,6})\b/i)
  if (m2) return Number(m2[1])
  return null
}

/** Extrae términos de producto/servicio para buscar en el catálogo. */
export function extractBusquedaProducto(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  const keywordNorm = PRODUCTO_KEYWORDS.map((k) =>
    k
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
  )
  const hitIdx = keywordNorm.findIndex((k) => normalized.includes(k))
  if (hitIdx >= 0) return keywordNorm[hitIdx]

  const words = normalized
    .split(/[^\w]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
  if (!words.length) return ''
  return words.slice(-5).join(' ').trim()
}

async function getAjustesPrecios(supabase: SupabaseClient): Promise<ConfigAjustesPreciosVentas> {
  try {
    const { data, error } = await supabase.rpc('get_configuracion_precios_ventas')
    if (error || !data) return DEFAULT_AJUSTES
    return normalizarConfigAjustes(data)
  } catch {
    return DEFAULT_AJUSTES
  }
}

function labelAjustes(config: ConfigAjustesPreciosVentas): string {
  const partes: string[] = []
  if (config.iva_activo && config.iva_porcentaje > 0) partes.push(`IVA ${config.iva_porcentaje}%`)
  for (const r of config.recargos) {
    if (r.activo && r.porcentaje > 0) partes.push(`${r.nombre} ${r.porcentaje}%`)
  }
  return partes.length ? partes.join(' + ') : 'sin ajustes adicionales'
}

/**
 * Arma contexto de Lista 1 (efectivo/débito) para el prompt del chat público.
 */
export async function buildLista1PreciosContext(
  supabase: SupabaseClient,
  userTexts: string[]
): Promise<string> {
  const joined = userTexts.join('\n').trim()
  if (!shouldLoadLista1PreciosContext(joined)) return ''

  const busqueda = extractBusquedaProducto(joined)
  const cantidad = extractCantidadSolicitada(joined)
  const selectCols = 'codigo, nombre, descripcion, categoria, precio_base, precio_lista_1'

  let query = supabase
    .from('articulos_empresa')
    .select(selectCols)
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .limit(busqueda.length >= 2 ? 30 : 40)

  if (busqueda.length >= 2) {
    const term = escapeIlike(busqueda)
    query = query.or(`nombre.ilike.%${term}%,descripcion.ilike.%${term}%,codigo.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error cargando lista 1 para chat:', error.message)
    return 'LISTA DE PRECIOS 1: no se pudo cargar el catálogo en este momento. Indicá al cliente que un asesor de mostrador puede cotizar por teléfono (2646212163).'
  }

  const rows = (data || []) as ArticuloPrecioRow[]
  const ajustes = await getAjustesPrecios(supabase)

  const lineas: string[] = []
  for (const row of rows) {
    const bruto = resolvePrecioLista1Bruto(row)
    if (bruto == null) continue
    const final = calcularPrecioFinalLista1(bruto, ajustes)
    const cod = row.codigo ? `[${row.codigo}] ` : ''
    const cat = row.categoria ? ` (${row.categoria})` : ''
    lineas.push(`- ${cod}${row.nombre || 'Sin nombre'}${cat}: ${formatArs(final)}`)
    if (lineas.length >= 25) break
  }

  if (!lineas.length) {
    const hint = busqueda
      ? `No hay artículos activos con Lista 1 que coincidan con "${busqueda}".`
      : 'No hay artículos activos con precio en Lista 1 cargado.'
    return (
      `LISTA DE PRECIOS 1 (efectivo/débito):\n${hint}\n` +
      'No inventes precios. Ofrecé que un asesor de mostrador cotice con medidas y cantidad.'
    )
  }

  const encabezado =
    `LISTA DE PRECIOS 1 (efectivo, transferencia, débito/tarjeta) — única fuente válida para cotizar precios al público.\n` +
    `Ajustes aplicados: ${labelAjustes(ajustes)}. Importes finales por unidad base del artículo.\n` +
    (busqueda ? `Búsqueda: "${busqueda}".\n` : 'Muestra de artículos del catálogo (sin término específico).\n') +
    (cantidad != null && cantidad > 0 ? `Cantidad mencionada por el cliente: ${cantidad} unidades (podés estimar total = precio unitario × cantidad si aplica).\n` : '')

  return `${encabezado}${lineas.join('\n')}`
}
