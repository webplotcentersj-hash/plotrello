import type { ArticuloEmpresaRecord } from '../types/api'

export const TIPOS_PRODUCTO_BRIEF = [
  'Diseño de una pieza gráfica',
  'Flyer',
  'Banner',
  'Carpetas',
  'Folletos',
  'Agendas',
  'Tarjetas personales',
  'Stickers',
  'Presentación PDF',
  'Packaging',
  'Brochure',
  'Cuaderno',
  'Calendario',
  'Logo',
  'Rediseño de logo existente',
  'Cartelería',
  'Ploteo vehicular',
  'Ploteo de vidrieras/comercios',
  'Señalética',
  'Diseño y desarrollo web. Automatización con IA',
  'No sé bien lo que necesito, quiero asesoramiento'
] as const

export type ClienteBriefFormData = {
  tipo_producto_servicio: string[]
  tipo_producto_otro: string
  necesita_asesoramiento: boolean
  donde_colocados: string
  digital_o_impresion: string
  cantidades: string
  objetivo_proyecto: string
  material_logo: string
  material_textos: string
  material_imagenes: string
  tiene_referencias: boolean
  referencias_links: string
  brief_publico: string
  estilo_diseno: string
  referencias: string
  fecha_limite_brief: string
  es_urgencia: boolean
}

export function emptyClienteBriefForm(): ClienteBriefFormData {
  return {
    tipo_producto_servicio: [],
    tipo_producto_otro: '',
    necesita_asesoramiento: false,
    donde_colocados: '',
    digital_o_impresion: '',
    cantidades: '',
    objetivo_proyecto: '',
    material_logo: '',
    material_textos: '',
    material_imagenes: '',
    tiene_referencias: false,
    referencias_links: '',
    brief_publico: '',
    estilo_diseno: '',
    referencias: '',
    fecha_limite_brief: '',
    es_urgencia: false
  }
}

const TIPO_KEYWORDS: Array<{ keywords: string[]; tipo: string }> = [
  { keywords: ['banner'], tipo: 'Banner' },
  { keywords: ['carpeta'], tipo: 'Carpetas' },
  { keywords: ['flyer', 'folleto'], tipo: 'Flyer' },
  { keywords: ['sticker', 'calco'], tipo: 'Stickers' },
  { keywords: ['tarjeta'], tipo: 'Tarjetas personales' },
  { keywords: ['logo'], tipo: 'Logo' },
  { keywords: ['cartel', 'carteler'], tipo: 'Cartelería' },
  { keywords: ['vehicular', 'plotear'], tipo: 'Ploteo vehicular' },
  { keywords: ['vidriera'], tipo: 'Ploteo de vidrieras/comercios' },
  { keywords: ['señalet', 'senal'], tipo: 'Señalética' },
  { keywords: ['agenda'], tipo: 'Agendas' },
  { keywords: ['brochure'], tipo: 'Brochure' }
]

export function inferTiposProductoBrief(articulo: Pick<ArticuloEmpresaRecord, 'nombre' | 'categoria'>): string[] {
  const haystack = `${articulo.nombre} ${articulo.categoria || ''}`.toLowerCase()
  const found = new Set<string>()
  for (const { keywords, tipo } of TIPO_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) found.add(tipo)
  }
  return [...found]
}
