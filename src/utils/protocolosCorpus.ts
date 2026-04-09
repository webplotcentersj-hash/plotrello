import type { ProtocoloBaseRecord } from '../types/api'
import { extractTextFromPdfArrayBuffer } from './protocolosPdfText'

const MAX_PER_DOC = 35_000
const MAX_TOTAL = 95_000

function looksPdf(doc: ProtocoloBaseRecord): boolean {
  const m = (doc.file_mime || '').toLowerCase()
  if (m.includes('pdf')) return true
  const n = (doc.archivo_nombre || '').toLowerCase()
  return n.endsWith('.pdf')
}

function looksPlainText(doc: ProtocoloBaseRecord): boolean {
  const m = (doc.file_mime || '').toLowerCase()
  if (m.includes('text/plain')) return true
  const n = (doc.archivo_nombre || '').toLowerCase()
  return n.endsWith('.txt')
}

function isWord(doc: ProtocoloBaseRecord): boolean {
  const m = (doc.file_mime || '').toLowerCase()
  const n = (doc.archivo_nombre || '').toLowerCase()
  return m.includes('wordprocessing') || m.includes('msword') || n.endsWith('.doc') || n.endsWith('.docx')
}

export interface ProtocolosCorpusResult {
  text: string
  warnings: string[]
}

export async function buildProtocolosCorpus(items: ProtocoloBaseRecord[]): Promise<ProtocolosCorpusResult> {
  const warnings: string[] = []
  const parts: string[] = []
  let total = 0

  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  for (const doc of sorted) {
    const meta = [
      `### Documento: ${doc.titulo}`,
      `Tipo: ${doc.tipo}${doc.categoria ? ` | Categoría: ${doc.categoria}` : ''}`,
      doc.tags?.length ? `Tags: ${doc.tags.join(', ')}` : '',
      doc.archivo_nombre ? `Archivo: ${doc.archivo_nombre}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    let body = ''

    if (doc.contenido_texto?.trim()) {
      body = doc.contenido_texto.trim()
    } else if (doc.archivo_url) {
      if (looksPdf(doc)) {
        try {
          const res = await fetch(doc.archivo_url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buf = await res.arrayBuffer()
          body = await extractTextFromPdfArrayBuffer(buf)
          if (!body.trim()) {
            warnings.push(`"${doc.titulo}": PDF sin texto extraíble (¿escaneado o solo imágenes?).`)
          }
        } catch (e) {
          warnings.push(
            `"${doc.titulo}": no se pudo leer el PDF (${e instanceof Error ? e.message : 'error'}).`
          )
        }
      } else if (looksPlainText(doc)) {
        try {
          const res = await fetch(doc.archivo_url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          body = (await res.text()).trim()
        } catch (e) {
          warnings.push(
            `"${doc.titulo}": no se pudo descargar el texto (${e instanceof Error ? e.message : 'error'}).`
          )
        }
      } else if (isWord(doc)) {
        warnings.push(
          `"${doc.titulo}": Word no se indexa en el chat; exportá a PDF o guardá el texto con PlotAI.`
        )
        continue
      } else {
        warnings.push(`"${doc.titulo}": formato de archivo no indexado para el chat.`)
        continue
      }
    } else {
      warnings.push(`"${doc.titulo}": sin contenido ni archivo.`)
      continue
    }

    if (!body.trim()) continue

    const slice =
      body.length > MAX_PER_DOC ? `${body.slice(0, MAX_PER_DOC)}\n[... contenido truncado ...]` : body
    const block = `${meta}\n\n${slice}`

    if (total + block.length > MAX_TOTAL) {
      warnings.push(
        'Corpus global truncado por límite de tamaño (prioridad: documentos más recientes).'
      )
      break
    }

    parts.push(block)
    total += block.length + 8
  }

  return {
    text: parts.join('\n\n---\n\n'),
    warnings,
  }
}
