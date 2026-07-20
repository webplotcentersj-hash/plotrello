export type MockupProductKind =
  | 'banner'
  | 'banner-vertical'
  | 'flyer'
  | 'card'
  | 'sticker'
  | 'logo'
  | 'sign'
  | 'vehicle'
  | 'folder'
  | 'notebook'
  | 'packaging'
  | 'presentation'
  | 'generic'

export type MockupSceneKind = 'storefront' | 'interior' | 'vehicle' | 'digital' | 'window' | 'event'

const PRODUCT_RULES: Array<{ match: RegExp; kind: MockupProductKind }> = [
  { match: /roll\s*up|rollup|pendón vertical/i, kind: 'banner-vertical' },
  { match: /banner|lona|gigantograf/i, kind: 'banner' },
  { match: /flyer|folleto|brochure|diptico|díptico/i, kind: 'flyer' },
  { match: /carpeta/i, kind: 'folder' },
  { match: /agenda|cuaderno|calendario/i, kind: 'notebook' },
  { match: /packaging|envase|caja/i, kind: 'packaging' },
  { match: /presentaci[oó]n|\bpdf\b/i, kind: 'presentation' },
  { match: /tarjeta/i, kind: 'card' },
  { match: /sticker|calcoman|vinilo(?!\s*vehicul)/i, kind: 'sticker' },
  { match: /logo|isotipo|identidad|redi[s]?eño/i, kind: 'logo' },
  { match: /vehicul|plotear|auto|camioneta|flota/i, kind: 'vehicle' },
  { match: /cartel|señalet|senalet|letrero|vidriera|comercio|ploteo/i, kind: 'sign' }
]

const SCENE_RULES: Array<{ match: RegExp; scene: MockupSceneKind }> = [
  { match: /vehicul|auto|camioneta|flota|plotear/i, scene: 'vehicle' },
  { match: /redes|instagram|facebook|web|digital|pantalla|mail|newsletter/i, scene: 'digital' },
  { match: /evento|feria|stand|expo|feria/i, scene: 'event' },
  { match: /ventana|vidrio|escaparate/i, scene: 'window' },
  { match: /afuera|exterior|fachada|calle|entrada|vereda|carteler[ií]a exterior/i, scene: 'storefront' },
  { match: /local|tienda|comercio|vidriera/i, scene: 'storefront' },
  { match: /interior|pared|mostrador|salón|salon|recepción|recepcion|oficina/i, scene: 'interior' }
]

export function resolveMockupProduct(nombre: string, categoria?: string | null): MockupProductKind {
  const text = `${nombre} ${categoria || ''}`.trim()
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
  if (productKind === 'presentation' && !ubicacion.trim()) return 'digital'
  if (productKind === 'vehicle') return 'vehicle'

  const text = ubicacion.trim()
  if (text) {
    for (const rule of SCENE_RULES) {
      if (rule.match.test(text)) return rule.scene
    }
  }
  // Piezas de mano: no forzar pared interior si no eligieron ubicación
  if (
    productKind === 'flyer' ||
    productKind === 'card' ||
    productKind === 'folder' ||
    productKind === 'notebook' ||
    productKind === 'packaging' ||
    productKind === 'sticker'
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
    window: 'behind a shop window glass',
    event: 'at a trade fair booth or event stand'
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
    folder: 'branded presentation folders',
    notebook: 'branded notebook or agenda',
    packaging: 'custom product packaging box',
    presentation: 'digital presentation slides on screen',
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
