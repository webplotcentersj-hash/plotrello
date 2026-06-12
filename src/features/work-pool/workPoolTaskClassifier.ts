export type WorkPoolTaskCategory =
  | 'etiquetas'
  | 'tarjetas'
  | 'logo'
  | 'banner'
  | 'senaletica'
  | 'packaging'
  | 'editorial'
  | 'vehicular'
  | 'general'

export const WORK_POOL_TASK_CATEGORY_LABELS: Record<WorkPoolTaskCategory, string> = {
  etiquetas: 'Etiquetas / adhesivos',
  tarjetas: 'Tarjetas personales',
  logo: 'Logo / identidad',
  banner: 'Banners / lonas',
  senaletica: 'Señalética / vinilos',
  packaging: 'Packaging / fajas',
  editorial: 'Editorial / catálogo',
  vehicular: 'Diseño vehicular',
  general: 'Diseño general'
}

const RULES: Array<{ category: WorkPoolTaskCategory; patterns: RegExp[] }> = [
  {
    category: 'etiquetas',
    patterns: [/etiquet/i, /\badhesiv/i, /\bstiker/i, /\bsticker/i, /\bfaja/i, /precorte/i, /pre-corte/i]
  },
  {
    category: 'tarjetas',
    patterns: [/tarjeta/i, /business\s*card/i, /\bflyer/i, /folleto/i]
  },
  {
    category: 'logo',
    patterns: [/logo/i, /identidad\s*visual/i, /isotipo/i, /retoque/i]
  },
  {
    category: 'banner',
    patterns: [/banner/i, /lona/i, /gigantograf/i, /plotter/i]
  },
  {
    category: 'senaletica',
    patterns: [/señalet/i, /senalet/i, /vinilo/i, /señal/i, /corporeo/i]
  },
  {
    category: 'packaging',
    patterns: [/packaging/i, /envase/i, /caja\b/i, /pack\b/i]
  },
  {
    category: 'editorial',
    patterns: [/revista/i, /catálogo/i, /catalogo/i, /libro/i, /editorial/i, /recetario/i]
  },
  {
    category: 'vehicular',
    patterns: [/vehicular/i, /vehículo/i, /vehiculo/i, /flota/i]
  }
]

const TARIFA_CATEGORY: Record<string, WorkPoolTaskCategory> = {
  logo_simple: 'logo',
  banner: 'banner',
  senaletica: 'senaletica',
  vehicular: 'vehicular',
  retoque: 'logo'
}

export function classifyWorkPoolTask(
  descripcion?: string | null,
  codigoTarifa?: string | null,
  titulo?: string | null
): WorkPoolTaskCategory {
  if (codigoTarifa && TARIFA_CATEGORY[codigoTarifa]) {
    return TARIFA_CATEGORY[codigoTarifa]
  }

  const blob = `${titulo ?? ''} ${descripcion ?? ''}`.toLowerCase()
  if (!blob.trim()) return 'general'

  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(blob))) return rule.category
  }
  return 'general'
}

export function taskCategoryKeywords(category: WorkPoolTaskCategory): string[] {
  const map: Record<WorkPoolTaskCategory, string[]> = {
    etiquetas: ['etiquet', 'adhesiv', 'stiker', 'sticker', 'faja'],
    tarjetas: ['tarjeta', 'flyer', 'folleto'],
    logo: ['logo', 'identidad', 'isotipo'],
    banner: ['banner', 'lona', 'gigantograf'],
    senaletica: ['vinilo', 'señalet', 'senalet', 'corporeo'],
    packaging: ['packaging', 'envase', 'caja'],
    editorial: ['revista', 'catalogo', 'catálogo', 'editorial'],
    vehicular: ['vehicular', 'vehiculo', 'vehículo'],
    general: []
  }
  return map[category]
}
