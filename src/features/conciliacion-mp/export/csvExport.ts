import type { HeuristicMatch, NormalizedMovement } from '../domain/types'

function esc(s: string): string {
  const t = String(s ?? '')
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function movDay(iso: string): string {
  return iso.slice(0, 10)
}

/** CSV con BOM UTF-8 para Excel */
export function downloadCsv(filename: string, rows: string[][]): void {
  const header = rows[0]
  const lines = [header.map(esc).join(',')]
  for (let i = 1; i < rows.length; i++) {
    lines.push(rows[i].map((c) => esc(String(c))).join(','))
  }
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildMatchesCsvRows(
  matches: HeuristicMatch[],
  bankById: Map<string, NormalizedMovement>,
  mpById: Map<string, NormalizedMovement>
): string[][] {
  const rows: string[][] = [
    [
      'tipo_match',
      'fase',
      'score',
      'banco_id',
      'banco_fecha',
      'banco_importe',
      'banco_descripcion',
      'mp_cantidad',
      'mp_ids',
      'suma_mp',
      'diff_monto',
      'motivo'
    ]
  ]
  for (const m of matches) {
    const b = m.bankIds.map((id) => bankById.get(id)).filter(Boolean) as NormalizedMovement[]
    const mp = m.mpIds.map((id) => mpById.get(id)).filter(Boolean) as NormalizedMovement[]
    const b0 = b[0]
    const sumMp = mp.reduce((s, x) => s + x.importeNeto, 0)
    const diff = b0 ? Math.abs(b0.importeNeto - sumMp) : 0
    rows.push([
      m.matchType,
      String(m.phase),
      String(m.score),
      b0?.id ?? '',
      b0 ? movDay(b0.fecha) : '',
      b0 ? String(b0.importeNeto) : '',
      b0 ? b0.descripcion.slice(0, 200) : '',
      String(mp.length),
      m.mpIds.join(';'),
      String(sumMp),
      String(diff),
      m.reason.slice(0, 500)
    ])
  }
  return rows
}

export function buildMovementsCsvRows(movements: NormalizedMovement[], titulo: string): string[][] {
  const rows: string[][] = [
    ['tipo', 'id', 'fecha', 'importe', 'clasificacion', 'descripcion', 'referencia', 'hoja', 'fila']
  ]
  for (const m of movements) {
    rows.push([
      titulo,
      m.id,
      movDay(m.fecha),
      String(m.importeNeto),
      m.classification,
      m.descripcion.slice(0, 300),
      m.referencia ?? '',
      m.hojaOriginal,
      String(m.filaOriginal)
    ])
  }
  return rows
}
