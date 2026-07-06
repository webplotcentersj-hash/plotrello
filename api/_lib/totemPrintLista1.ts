import type { SupabaseClient } from '@supabase/supabase-js'

export type TotemPrintFormato = 'A4' | 'A3'
export type TotemPrintColorMode = 'color' | 'bw' | 'mixed'

export type TotemPrintQuoteInput = {
  formato: TotemPrintFormato
  tipo_impresion: string
  cantidad_hojas: number
  color_pages?: number
  bw_pages?: number
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

const ARTICULO_SEARCH: Record<string, string[]> = {
  'A4-color': ['impresiones a4 ilustracion color 115grs', 'impresiones a4 color obra 80grs'],
  'A4-bw': ['impresiones a4 b/n obra 80grs', 'impresiones a4 b/n obra 120'],
  'A3-color': ['impresiones a3 ilustracion color 115grs', 'impresiones a3 color obra 80grs'],
  'A3-bw': ['impresiones a3 b/n obra 80grs', 'impresiones a3 b/n obra 120']
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
  return /foto\s*libros|\b\d{1,3}\s+impresiones?\s+a\s*[345]/i.test(n)
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
      .limit(12)

    const rows = (data || []) as ArticuloRow[]
    const match = rows.find((r) => resolveBruto(r) != null && !isPaqueteFijo(r.nombre || ''))
    if (match) return match
  }
  return null
}

export function parseTotemTipoImpresion(tipo: string): {
  format: TotemPrintFormato
  mode: TotemPrintColorMode
  colorPages: number
  bwPages: number
} {
  const t = String(tipo || '').toLowerCase()
  const format: TotemPrintFormato = t.includes('a3') ? 'A3' : 'A4'
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
  const hojas = Math.max(1, Math.floor(Number(input.cantidad_hojas) || 1))

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

  const ajustes = await getAjustes(supabase)
  const items: TotemPrintQuoteLine[] = []

  const addLine = async (key: string, qty: number) => {
    if (qty < 1) return
    const terms = ARTICULO_SEARCH[key]
    if (!terms?.length) return
    const row = await buscarArticulo(supabase, terms)
    if (!row) return
    const bruto = resolveBruto(row)
    if (bruto == null) return
    const unit = calcularFinalLista1(bruto, ajustes)
    items.push({
      codigo: row.codigo,
      descripcion: row.nombre || key,
      cantidad: qty,
      precio_unitario: unit,
      subtotal: round2(unit * qty)
    })
  }

  if (colorQty > 0) await addLine(`${formato}-color`, colorQty)
  if (bwQty > 0) await addLine(`${formato}-bw`, bwQty)

  if (!items.length) {
    return {
      ok: false,
      total: 0,
      items: [],
      error: 'No encontramos precio en Lista 1 para este tipo de impresión. Consultá en mostrador.'
    }
  }

  const total = round2(items.reduce((s, i) => s + i.subtotal, 0))
  if (total < 1) {
    return { ok: false, total: 0, items, error: 'El total calculado es menor a $1.' }
  }

  return { ok: true, total, items }
}
