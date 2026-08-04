export type MockupProductKind =
  | 'banner'
  | 'banner-vertical'
  | 'flyer'
  | 'brochure'
  | 'card'
  | 'sticker'
  | 'logo'
  | 'sign'
  | 'wayfinding'
  | 'vehicle'
  | 'window-wrap'
  | 'folder'
  | 'notebook'
  | 'calendar'
  | 'packaging'
  | 'presentation'
  | 'generic'

export type MockupSceneKind = 'storefront' | 'interior' | 'vehicle' | 'digital' | 'window' | 'event'

/** Mapa exacto de chips del brief → silueta del mockup. */
export const TIPO_PRODUCTO_TO_KIND: Record<string, MockupProductKind> = {
  'Diseño de una pieza gráfica': 'generic',
  Flyer: 'flyer',
  Banner: 'banner-vertical',
  Carpetas: 'folder',
  Folletos: 'brochure',
  Agendas: 'notebook',
  'Tarjetas personales': 'card',
  Stickers: 'sticker',
  'Presentación PDF': 'presentation',
  Packaging: 'packaging',
  Brochure: 'brochure',
  Cuaderno: 'notebook',
  Calendario: 'calendar',
  Logo: 'logo',
  'Rediseño de logo existente': 'logo',
  Cartelería: 'sign',
  'Ploteo vehicular': 'vehicle',
  'Ploteo de vidrieras/comercios': 'window-wrap',
  Señalética: 'wayfinding',
  'Diseño y desarrollo web. Automatización con IA': 'presentation'
}

const PRODUCT_RULES: Array<{ match: RegExp; kind: MockupProductKind }> = [
  { match: /roll\s*up|rollup|pendón|pendon vertical/i, kind: 'banner-vertical' },
  { match: /\bbanner\b|lona|gigantograf/i, kind: 'banner-vertical' },
  { match: /brochure|folleto|tr[ií]ptico|diptico|díptico/i, kind: 'brochure' },
  { match: /\bflyer\b/i, kind: 'flyer' },
  { match: /calendario/i, kind: 'calendar' },
  { match: /carpeta/i, kind: 'folder' },
  { match: /agenda|cuaderno/i, kind: 'notebook' },
  { match: /packaging|envase|caja/i, kind: 'packaging' },
  { match: /presentaci[oó]n|\bpdf\b|web|landing|automatiz/i, kind: 'presentation' },
  { match: /tarjeta/i, kind: 'card' },
  { match: /sticker|calcoman/i, kind: 'sticker' },
  { match: /logo|isotipo|identidad|redi[s]?eño/i, kind: 'logo' },
  { match: /vehicular|veh[ií]culo|camioneta|flota|\bauto\b/i, kind: 'vehicle' },
  { match: /vidriera|escaparate|comercio.*ploteo|ploteo.*vidrio/i, kind: 'window-wrap' },
  { match: /señalet|senalet|wayfinding/i, kind: 'wayfinding' },
  { match: /cartel|letrero|carteler/i, kind: 'sign' },
  { match: /ploteo/i, kind: 'sign' }
]

const SCENE_RULES: Array<{ match: RegExp; scene: MockupSceneKind }> = [
  { match: /vehicul|auto|camioneta|flota|plotear/i, scene: 'vehicle' },
  { match: /redes|instagram|facebook|web|digital|pantalla|mail|newsletter|pdf/i, scene: 'digital' },
  { match: /evento|feria|stand|expo/i, scene: 'event' },
  { match: /ventana|vidrio|escaparate|vidriera/i, scene: 'window' },
  { match: /afuera|exterior|fachada|calle|entrada|vereda|carteler[ií]a exterior/i, scene: 'storefront' },
  { match: /local|tienda|comercio/i, scene: 'storefront' },
  { match: /interior|pared|mostrador|salón|salon|recepción|recepcion|oficina/i, scene: 'interior' }
]

export function resolveMockupProduct(nombre: string, categoria?: string | null): MockupProductKind {
  const trimmed = nombre.trim()
  const exact = TIPO_PRODUCTO_TO_KIND[trimmed]
  if (exact) return exact

  const text = `${trimmed} ${categoria || ''}`.trim()
  for (const rule of PRODUCT_RULES) {
    if (rule.match.test(text)) return rule.kind
  }
  return 'generic'
}

export function resolveMockupScene(
  ubicacion: string,
  productKind?: MockupProductKind,
  digitalOImpresion?: string
): MockupSceneKind {
  if (digitalOImpresion === 'digital') return 'digital'
  if (productKind === 'presentation') return 'digital'
  if (productKind === 'vehicle') return 'vehicle'
  if (productKind === 'window-wrap') return 'window'
  if (productKind === 'sign') return 'storefront'
  if (productKind === 'banner-vertical' || productKind === 'banner') return 'event'
  if (productKind === 'wayfinding') return 'interior'

  const text = ubicacion.trim()
  if (text) {
    for (const rule of SCENE_RULES) {
      if (rule.match.test(text)) return rule.scene
    }
  }
  if (
    productKind === 'flyer' ||
    productKind === 'brochure' ||
    productKind === 'card' ||
    productKind === 'folder' ||
    productKind === 'notebook' ||
    productKind === 'calendar' ||
    productKind === 'packaging' ||
    productKind === 'sticker' ||
    productKind === 'logo'
  ) {
    return 'interior'
  }
  return 'interior'
}

export function labelFormatoPedido(value: string): string {
  if (value === 'digital') return 'Digital'
  if (value === 'impresion') return 'Impresión'
  if (value === 'ambos') return 'Digital e impresión'
  return ''
}

export function inferTiposProducto(nombres: string[]): string[] {
  const tipos = new Set<string>()
  for (const nombre of nombres) {
    const n = nombre.toLowerCase()
    if (/banner|lona/i.test(n)) tipos.add('Banner')
    else if (/flyer/i.test(n)) tipos.add('Flyer')
    else if (/folleto|brochure/i.test(n)) tipos.add('Folletos')
    else if (/tarjeta/i.test(n)) tipos.add('Tarjetas personales')
    else if (/logo/i.test(n)) tipos.add('Logo')
    else if (/sticker|calcoman/i.test(n)) tipos.add('Stickers')
    else if (/vehicul|vehicular/i.test(n)) tipos.add('Ploteo vehicular')
    else if (/vidriera/i.test(n)) tipos.add('Ploteo de vidrieras/comercios')
    else if (/señalet|senalet/i.test(n)) tipos.add('Señalética')
    else if (/cartel|carteler/i.test(n)) tipos.add('Cartelería')
    else if (/web|ia|automatiz/i.test(n)) tipos.add('Diseño y desarrollo web. Automatización con IA')
    else tipos.add(nombre)
  }
  return [...tipos]
}

export function buildBriefFromPedido(input: {
  especificacion: string
  donde_colocados: string
  cantidades: string
  digital_o_impresion: string
  items: Array<{ nombre?: string; descripcion_personalizada?: string }>
}): string {
  const parts: string[] = []
  if (input.especificacion.trim()) {
    parts.push(`Especificación del cliente:\n${input.especificacion.trim()}`)
  }
  if (input.donde_colocados.trim()) {
    parts.push(`Ubicación / uso: ${input.donde_colocados.trim()}`)
  }
  if (input.digital_o_impresion) {
    parts.push(`Formato: ${input.digital_o_impresion}`)
  }
  if (input.cantidades.trim()) {
    parts.push(`Cantidades: ${input.cantidades.trim()}`)
  }
  const itemsLines = input.items
    .map((it) => {
      const line = it.nombre || 'Artículo'
      const desc = it.descripcion_personalizada?.trim()
      return desc ? `- ${line}: ${desc}` : `- ${line}`
    })
    .join('\n')
  if (itemsLines) parts.push(`Artículos:\n${itemsLines}`)
  return parts.join('\n\n')
}

export function buildMockupImagePrompt(input: {
  productLabel: string
  productKind: MockupProductKind
  sceneKind: MockupSceneKind
  especificacion: string
  donde_colocados: string
}): string {
  const sceneLabels: Record<MockupSceneKind, string> = {
    storefront: 'mounted outside a retail storefront on the street',
    interior: 'displayed on an interior wall of a shop',
    vehicle: 'applied as wrap on a passenger car',
    digital: 'shown on a modern laptop or desktop PC screen',
    window: 'behind a shop window glass',
    event: 'at a trade fair booth or event stand'
  }
  const productLabels: Record<MockupProductKind, string> = {
    banner: 'large printed banner',
    'banner-vertical': 'vertical roll-up banner stand',
    flyer: 'single-sheet promotional flyer',
    brochure: 'tri-fold brochure leaflet',
    card: 'business cards',
    sticker: 'die-cut stickers',
    logo: 'logo mark on clean mockup',
    sign: 'large poster or outdoor signboard',
    wayfinding: 'interior wayfinding signage panel',
    vehicle: 'vehicle wrap graphics on a car',
    'window-wrap': 'storefront window vinyl graphics',
    folder: 'branded presentation folders',
    notebook: 'branded notebook or agenda',
    calendar: 'wall or desk calendar with month grid',
    packaging: 'custom product packaging box',
    presentation: 'slides or website on a computer screen',
    generic: 'printed graphic product'
  }
  const ubicacion = input.donde_colocados.trim()
  const spec = input.especificacion.trim()
  return [
    `Realistic mockup photo for a print shop client preview.`,
    `${productLabels[input.productKind]} (${input.productLabel})`,
    sceneLabels[input.sceneKind],
    ubicacion ? `Placement context: ${ubicacion}.` : '',
    spec ? `Design brief: ${spec}.` : '',
    'Professional lighting, clean composition, no watermark, no readable fake brand names.'
  ]
    .filter(Boolean)
    .join(' ')
}
