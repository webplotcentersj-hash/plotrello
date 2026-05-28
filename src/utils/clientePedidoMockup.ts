export type MockupProductKind =
  | 'banner'
  | 'banner-vertical'
  | 'flyer'
  | 'card'
  | 'sticker'
  | 'logo'
  | 'sign'
  | 'vehicle'
  | 'generic'

export type MockupSceneKind = 'storefront' | 'interior' | 'vehicle' | 'digital' | 'window'

const PRODUCT_RULES: Array<{ match: RegExp; kind: MockupProductKind }> = [
  { match: /banner|lona|gigantograf/i, kind: 'banner' },
  { match: /roll\s*up|rollup|pendón vertical/i, kind: 'banner-vertical' },
  { match: /flyer|folleto|catálogo|catalogo|brochure|diptico|díptico/i, kind: 'flyer' },
  { match: /tarjeta/i, kind: 'card' },
  { match: /sticker|calcoman|vinilo/i, kind: 'sticker' },
  { match: /logo|isotipo|identidad/i, kind: 'logo' },
  { match: /vehicul|plotear|auto|camioneta/i, kind: 'vehicle' },
  { match: /cartel|señalet|senalét|letrero|ploteo.*vidriera/i, kind: 'sign' }
]

const SCENE_RULES: Array<{ match: RegExp; scene: MockupSceneKind }> = [
  { match: /afuera|exterior|fachada|calle|entrada|vereda|local|tienda|comercio|vidriera/i, scene: 'storefront' },
  { match: /vehicul|auto|camioneta|flota|plotear/i, scene: 'vehicle' },
  { match: /redes|instagram|facebook|web|digital|pantalla|mail|newsletter/i, scene: 'digital' },
  { match: /ventana|vidrio|escaparate/i, scene: 'window' },
  { match: /interior|pared|mostrador|salón|salon|recepción|recepcion|oficina/i, scene: 'interior' }
]

export function resolveMockupProduct(nombre: string, categoria?: string | null): MockupProductKind {
  const text = `${nombre} ${categoria || ''}`.trim()
  for (const rule of PRODUCT_RULES) {
    if (rule.match.test(text)) return rule.kind
  }
  return 'generic'
}

export function resolveMockupScene(ubicacion: string, productKind?: MockupProductKind): MockupSceneKind {
  const text = ubicacion.trim()
  if (text) {
    for (const rule of SCENE_RULES) {
      if (rule.match.test(text)) return rule.scene
    }
  }
  if (productKind === 'vehicle') return 'vehicle'
  return 'interior'
}

export function inferTiposProducto(nombres: string[]): string[] {
  const tipos = new Set<string>()
  for (const nombre of nombres) {
    const n = nombre.toLowerCase()
    if (/banner|lona/i.test(n)) tipos.add('Banner')
    else if (/flyer|folleto/i.test(n)) tipos.add('Flyer')
    else if (/tarjeta/i.test(n)) tipos.add('Tarjetas personales')
    else if (/logo/i.test(n)) tipos.add('Logo')
    else if (/sticker|calcoman/i.test(n)) tipos.add('Stickers')
    else if (/vehicul|plotear/i.test(n)) tipos.add('Ploteo vehicular')
    else if (/vidriera|cartel|carteler/i.test(n)) tipos.add('Cartelería')
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
    vehicle: 'applied as wrap on a commercial van',
    digital: 'shown on a modern digital screen mockup',
    window: 'behind a shop window glass'
  }
  const productLabels: Record<MockupProductKind, string> = {
    banner: 'large horizontal printed banner',
    'banner-vertical': 'vertical roll-up banner stand',
    flyer: 'stack of printed flyers',
    card: 'business cards',
    sticker: 'die-cut stickers',
    logo: 'logo signage',
    sign: 'outdoor sign',
    vehicle: 'vehicle wrap graphics',
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
