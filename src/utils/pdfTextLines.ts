import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerConfigured = false

function ensureWorker(): void {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  workerConfigured = true
}

type TextItem = { str: string; x: number; y: number }

/** Agrupa ítems del PDF por fila (coordenada Y) y ordena por X → una línea por fila real. */
export async function extractLinesFromPdfArrayBuffer(buffer: ArrayBuffer): Promise<string[]> {
  ensureWorker()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  const lines: string[] = []

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      const items: TextItem[] = []

      for (const raw of content.items) {
        if (!raw || typeof raw !== 'object' || !('str' in raw)) continue
        const str = String((raw as { str: string }).str).trim()
        if (!str) continue
        const tr = (raw as { transform?: number[] }).transform
        const x = tr?.[4] ?? 0
        const y = tr?.[5] ?? 0
        items.push({ str, x, y })
      }

      const rowMap = new Map<number, TextItem[]>()
      for (const it of items) {
        const rowKey = Math.round(it.y / 4)
        const row = rowMap.get(rowKey) ?? []
        row.push(it)
        rowMap.set(rowKey, row)
      }

      const sortedRows = [...rowMap.entries()].sort((a, b) => b[0] - a[0])
      for (const [, rowItems] of sortedRows) {
        rowItems.sort((a, b) => a.x - b.x)
        const line = rowItems
          .map((i) => i.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (line.length > 2) lines.push(line)
      }
    }
  } finally {
    await pdf.destroy()
  }

  return lines
}

/** Texto plano (fallback): une líneas con salto. */
export async function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const lines = await extractLinesFromPdfArrayBuffer(buffer)
  return lines.join('\n')
}
