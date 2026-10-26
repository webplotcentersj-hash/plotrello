/** Helpers de presentación compartidos por las pantallas contables del ERP. */

export function fmtMoney(n: number | string | null | undefined): string {
  const v = Number(n)
  return (Number.isFinite(v) ? v : 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

export function fmtFecha(f: string | null | undefined): string {
  if (!f) return '—'
  const [y, m, d] = String(f).slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(f)
}

export function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function periodoActual(): string {
  return hoyIso().slice(0, 7)
}

export function descargarTexto(nombre: string, contenido: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([contenido], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function escCsv(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function descargarCsv(nombre: string, cabecera: string[], filas: Array<Array<string | number | null | undefined>>): void {
  const lineas = [cabecera, ...filas].map((f) => f.map(escCsv).join(','))
  // BOM para que Excel respete los acentos.
  descargarTexto(nombre, '\uFEFF' + lineas.join('\n'), 'text/csv;charset=utf-8;')
}

/** Parsea CSV simple con separador , o ; y comillas dobles. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '')
  const primera = limpio.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ','
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let comillas = false
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === sep) {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++
      fila.push(campo)
      if (fila.some((x) => x.trim() !== '')) filas.push(fila)
      fila = []
      campo = ''
    } else campo += c
  }
  fila.push(campo)
  if (fila.some((x) => x.trim() !== '')) filas.push(fila)
  return filas
}

/** Número en formato local o inglés: "1.234,56" / "1234.56" / "1,234.56". */
export function parsearNumero(s: string): number {
  const t = String(s ?? '').trim().replace(/[$\s]/g, '')
  if (!t) return 0
  const coma = t.lastIndexOf(',')
  const punto = t.lastIndexOf('.')
  let normal = t
  if (coma > punto) normal = t.replace(/\./g, '').replace(',', '.')
  else if (punto > coma) normal = t.replace(/,/g, '')
  const n = Number(normal)
  return Number.isFinite(n) ? n : 0
}
