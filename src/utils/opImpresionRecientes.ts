const TIPO_OP_KEY = 'plotrello_tipo_impresion_recent'
const TIPO_LINEA_KEY = 'plotrello_linea_m2_tipo_recent'
const MAX = 24

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* storage lleno o modo privado */
  }
}

function pushUnique(list: string[], value: string, max: number): string[] {
  const t = value.trim()
  if (!t) return list
  const lower = t.toLowerCase()
  const rest = list.filter((x) => x.trim().toLowerCase() !== lower)
  return [t, ...rest].slice(0, max)
}

/** Sugerencias para el campo "tipo de impresión" de la OP. */
export function getRecentTiposImpresionOp(): string[] {
  return readList(TIPO_OP_KEY)
}

/** Sugerencias para el campo "tipo" de cada línea m². */
export function getRecentTiposLineaM2(): string[] {
  return readList(TIPO_LINEA_KEY)
}

/** Guardar tras crear o editar OP (desde el tablero, cuando ya persistió en BD). */
export function recordTiposImpresionUsados(
  tipoOp?: string | null,
  lineas?: Array<{ tipo?: string | null }> | null
): void {
  let opList = readList(TIPO_OP_KEY)
  let lineaList = readList(TIPO_LINEA_KEY)
  if (tipoOp?.trim()) {
    opList = pushUnique(opList, tipoOp.trim(), MAX)
    writeList(TIPO_OP_KEY, opList)
  }
  if (lineas?.length) {
    for (const row of lineas) {
      const t = row.tipo?.trim()
      if (t) lineaList = pushUnique(lineaList, t, MAX)
    }
    writeList(TIPO_LINEA_KEY, lineaList)
  }
}
