import type { SupabaseClient } from '@supabase/supabase-js'

export type TotemPrintFormato = 'A4' | 'A3' | 'A3E'

/** Área A3E (32×45) / A3 (29.7×42) para cotizar sin ítem propio en lista. */
const A3E_AREA_FACTOR = (32 * 45) / (29.7 * 42)
export type TotemPrintColorMode = 'color' | 'bw' | 'mixed'
export type TotemPrintPapelId =
  | 'obra_80'
  | 'obra_120'
  | 'obra_180'
  | 'obra_240'
  | 'ilust_115'
  | 'ilust_170'
  | 'ilust_300'
  | 'ilust_350'
  | 'adh_ilust'
  | 'adh_obra'
  | 'esp_texturado'
  | 'esp_metalizado'
  | 'esp_perlado'

export type TotemPrintQuoteInput = {
  formato: TotemPrintFormato
  tipo_impresion: string
  cantidad_hojas: number
  color_pages?: number
  bw_pages?: number
  papel?: TotemPrintPapelId | string
  /** simple = 1 cara/hoja; doble = 2 caras/hoja (se cotizan ×2 en Lista 1). */
  faz?: 'simple' | 'doble' | string
}

export type TotemPrintQuoteLine = {
  codigo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type TotemPrintQuoteResult = {
  ok: boolean
  total: number
  items: TotemPrintQuoteLine[]
  error?: string
}

type ArticuloRow = {
  codigo?: string | null
  nombre?: string | null
  precio_base?: number | null
  precio_lista_1?: number | null
}

type ConfigAjustes = {
  iva_porcentaje: number
  iva_activo: boolean
  recargos: Array<{ activo: boolean; porcentaje: number }>
}

const DEFAULT_AJUSTES: ConfigAjustes = {
  iva_porcentaje: 21,
  iva_activo: true,
  recargos: []
}

const PAPEL_IDS = new Set<string>([
  'obra_80',
  'obra_120',
  'obra_180',
  'obra_240',
  'ilust_115',
  'ilust_170',
  'ilust_300',
  'ilust_350',
  'adh_ilust',
  'adh_obra',
  'esp_texturado',
  'esp_metalizado',
  'esp_perlado'
])

/** Términos de búsqueda en articulos_empresa (Lista 1), por papel + color/bn. */
function searchTermsForPapel(
  formato: TotemPrintFormato,
  papel: TotemPrintPapelId,
  tone: 'color' | 'bw'
): string[] {
  // A3 extendido usa artículos A3 (no hay SKU propio) y luego se aplica factor de área.
  const f = formato === 'A3E' ? 'a3' : formato.toLowerCase()

  if (papel === 'obra_80') {
    return tone === 'bw'
      ? [`impresiones ${f} b/n obra 80grs`, `impresiones ${f} b/n obra 80`]
      : [`impresiones ${f} color obra 80grs`, `impresiones ${f} color obra 80`]
  }

  // 120, 180 y 240 comparten ítem "120 A 180GRS" en lista (no hay 240 propio).
  if (papel === 'obra_120' || papel === 'obra_180' || papel === 'obra_240') {
    return tone === 'bw'
      ? [`impresiones ${f} b/n obra 120 a 180grs`, `impresiones ${f} b/n obra 120`]
      : [`impresiones ${f} color obra 120 a 180grs`, `impresiones ${f} color obra 120`]
  }

  if (papel === 'ilust_115') {
    return [`impresiones ${f} ilustracion color 115grs`, `impresiones ${f} ilustracion color 115`]
  }
  if (papel === 'ilust_170') {
    return [`impresiones ${f} ilustracion color 170grs`, `impresiones ${f} ilustracion color 170`]
  }
  if (papel === 'ilust_300') {
    return [`impresiones ${f} ilustracion color 300grs`, `impresiones ${f} ilustracion color 300`]
  }
  if (papel === 'ilust_350') {
    return [
      `impresiones ${f} ilustracion color 350grs`,
      `impresiones ${f} ilustracion color 350`
    ]
  }

  // Adhesivo: un solo ítem por formato en lista.
  if (papel === 'adh_ilust' || papel === 'adh_obra') {
    return [`impresiones papel adhesivo ${f}`, `papel adhesivo ${f}`, `impresiones ${f} adhesivo`]
  }

  // Especiales: Texturado / metalizado / perlado → PAPEL ESPECIAL Ax
  return [`papel especial ${f}`, `impresiones papel especial ${f}`]
}

/** Ilustración / adhesivo / especial: se cotiza con el ítem de papel (precio único). */
function papelUsaPrecioUnico(papel: TotemPrintPapelId): boolean {
  return (
    papel.startsWith('ilust_') ||
    papel.startsWith('adh_') ||
    papel.startsWith('esp_')
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function isPaqueteFijo(nombre: string): boolean {
  const n = normalizeNombre(nombre)
  return /foto\s*libros|\b\d{1,3}\s+impresiones?\s+a\s*[345]|mas corte|doble faz|plegado/i.test(n)
}

function resolveBruto(row: ArticuloRow): number | null {
  const v = row.precio_lista_1 ?? row.precio_base
  if (v == null || !Number.isFinite(Number(v)) || Number(v) < 0) return null
  return Number(v)
}

function calcularFinalLista1(bruto: number, config: ConfigAjustes): number {
  let totalPct = 0
  if (config.iva_activo && config.iva_porcentaje > 0) totalPct += config.iva_porcentaje
  for (const r of config.recargos) {
    if (r.activo && r.porcentaje > 0) totalPct += r.porcentaje
  }
  return round2(bruto * (1 + totalPct / 100))
}

async function getAjustes(supabase: SupabaseClient): Promise<ConfigAjustes> {
  try {
    const { data, error } = await supabase.rpc('get_configuracion_precios_ventas')
    if (error || !data || typeof data !== 'object') return DEFAULT_AJUSTES
    const o = data as Record<string, unknown>
    const recargos = Array.isArray(o.recargos)
      ? o.recargos.map((r) => {
          const item = r as Record<string, unknown>
          return {
            activo: item.activo !== false,
            porcentaje: Math.max(0, Number(item.porcentaje) || 0)
          }
        })
      : []
    return {
      iva_porcentaje: Math.max(0, Number(o.iva_porcentaje ?? 21) || 0),
      iva_activo: o.iva_activo !== false,
      recargos
    }
  } catch {
    return DEFAULT_AJUSTES
  }
}

function scoreMatch(nombre: string, term: string): number {
  const n = normalizeNombre(nombre)
  const t = normalizeNombre(term)
  if (n === t) return 100
  if (n.includes(t)) return 80 - Math.abs(n.length - t.length)
  return 0
}

async function buscarArticulo(
  supabase: SupabaseClient,
  searchTerms: string[]
): Promise<ArticuloRow | null> {
  for (const term of searchTerms) {
    const escaped = term.replace(/[%_\\]/g, '\\$&')
    const { data } = await supabase
      .from('articulos_empresa')
      .select('codigo, nombre, precio_base, precio_lista_1')
      .eq('activo', true)
      .ilike('nombre', `%${escaped}%`)
      .order('nombre', { ascending: true })
      .limit(20)

    const rows = ((data || []) as ArticuloRow[]).filter(
      (r) => resolveBruto(r) != null && !isPaqueteFijo(r.nombre || '')
    )
    if (!rows.length) continue
    rows.sort((a, b) => scoreMatch(b.nombre || '', term) - scoreMatch(a.nombre || '', term))
    return rows[0]
  }
  return null
}

export function normalizeTotemPrintPapel(raw?: string | null): TotemPrintPapelId {
  const v = String(raw || '').trim()
  if (PAPEL_IDS.has(v)) return v as TotemPrintPapelId
  const t = v.toLowerCase()
  if (t.includes('perl')) return 'esp_perlado'
  if (t.includes('metal')) return 'esp_metalizado'
  if (t.includes('textur')) return 'esp_texturado'
  if (t.includes('adhes') && t.includes('obra')) return 'adh_obra'
  if (t.includes('adhes')) return 'adh_ilust'
  if (t.includes('350')) return 'ilust_350'
  if (t.includes('300')) return 'ilust_300'
  if (t.includes('170')) return 'ilust_170'
  if (t.includes('115')) return 'ilust_115'
  if (t.includes('240')) return 'obra_240'
  if (t.includes('180')) return 'obra_180'
  if (t.includes('120')) return 'obra_120'
  if (t.includes('80')) return 'obra_80'
  return 'ilust_115'
}

export function parseTotemTipoImpresion(tipo: string): {
  format: TotemPrintFormato
  mode: TotemPrintColorMode
  colorPages: number
  bwPages: number
} {
  const t = String(tipo || '').toLowerCase()
  const format: TotemPrintFormato =
    t.includes('extend') || t.includes('a3e') || (t.includes('32') && t.includes('45'))
      ? 'A3E'
      : t.includes('a3')
        ? 'A3'
        : 'A4'
  const mix = String(tipo || '').match(/mixto\s*\((\d+)\s*color,\s*(\d+)\s*b\/n\)/i)
  if (mix) {
    return {
      format,
      mode: 'mixed',
      colorPages: Math.max(0, Number(mix[1]) || 0),
      bwPages: Math.max(0, Number(mix[2]) || 0)
    }
  }
  const bw =
    t.includes('blanco') || t.includes('negro') || t.includes('b/n') || t.includes('bn (detectado)')
  return { format, mode: bw ? 'bw' : 'color', colorPages: 0, bwPages: 0 }
}

export async function cotizarTotemImpresionLista1(
  supabase: SupabaseClient,
  input: TotemPrintQuoteInput
): Promise<TotemPrintQuoteResult> {
  const parsed = parseTotemTipoImpresion(input.tipo_impresion)
  const formato = input.formato || parsed.format
  const papel = normalizeTotemPrintPapel(input.papel || input.tipo_impresion)
  const fazRaw = String(input.faz || input.tipo_impresion || '').toLowerCase()
  const esDobleFaz = fazRaw === 'doble' || fazRaw.includes('doble faz')
  const hojas = Math.max(1, Math.floor(Number(input.cantidad_hojas) || 1))
  const carasFactor = esDobleFaz ? 2 : 1

  let colorQty = 0
  let bwQty = 0

  if (parsed.mode === 'mixed') {
    colorQty = Math.max(0, Number(input.color_pages ?? parsed.colorPages) || 0)
    bwQty = Math.max(0, Number(input.bw_pages ?? parsed.bwPages) || 0)
    if (colorQty + bwQty < 1) {
      colorQty = hojas
    }
  } else if (parsed.mode === 'bw') {
    bwQty = hojas
  } else {
    colorQty = hojas
  }

  // Papeles con precio único: no separar color/B/N en ítems distintos.
  if (papelUsaPrecioUnico(papel)) {
    const totalHojas = Math.max(1, colorQty + bwQty || hojas)
    colorQty = totalHojas
    bwQty = 0
  }

  colorQty *= carasFactor
  bwQty *= carasFactor

  const ajustes = await getAjustes(supabase)
  const items: TotemPrintQuoteLine[] = []

  const addLine = async (tone: 'color' | 'bw', qty: number) => {
    if (qty < 1) return
    const terms = searchTermsForPapel(formato, papel, tone)
    const row = await buscarArticulo(supabase, terms)
    if (!row) return
    const bruto = resolveBruto(row)
    if (bruto == null) return
    let unit = calcularFinalLista1(bruto, ajustes)
    if (formato === 'A3E') unit = round2(unit * A3E_AREA_FACTOR)
    const descBase = row.nombre || `${formato}-${papel}-${tone}`
    items.push({
      codigo: row.codigo,
      descripcion: formato === 'A3E' ? `${descBase} (A3 extendido 32×45)` : descBase,
      cantidad: qty,
      precio_unitario: unit,
      subtotal: round2(unit * qty)
    })
  }

  if (colorQty > 0) await addLine('color', colorQty)
  if (bwQty > 0) await addLine('bw', bwQty)

  if (!items.length) {
    return {
      ok: false,
      total: 0,
      items: [],
      error: 'No encontramos precio en Lista 1 para este papel / formato. Consultá en mostrador.'
    }
  }

  const total = round2(items.reduce((s, i) => s + i.subtotal, 0))
  if (total < 1) {
    return { ok: false, total: 0, items, error: 'El total calculado es menor a $1.' }
  }

  return { ok: true, total, items }
}
