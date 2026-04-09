import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerConfigured = false

function ensureWorker(): void {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  workerConfigured = true
}

export async function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  ensureWorker()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await loadingTask.promise
  try {
    const lines: string[] = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      const parts: string[] = []
      for (const item of content.items) {
        if (item && typeof item === 'object' && 'str' in item && typeof (item as { str: string }).str === 'string') {
          parts.push((item as { str: string }).str)
        }
      }
      const line = parts.join(' ').replace(/\s+/g, ' ').trim()
      if (line) lines.push(line)
    }
    return lines.join('\n\n').trim()
  } finally {
    await pdf.destroy()
  }
}
