/**
 * Genera PDF desde Markdown (jsPDF + marked).
 *
 * Uso:
 *   node scripts/build-manual-pdf.mjs
 *     → MANUAL_PROCESOS_ESTADOS.md → MANUAL_PROCESOS_ESTADOS.pdf
 *
 *   node scripts/build-manual-pdf.mjs MANUAL_OP_SECTORES_MULTIPLES.md
 *     → MANUAL_OP_SECTORES_MULTIPLES.pdf
 *
 *   node scripts/build-manual-pdf.mjs entrada.md salida.pdf
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsPDF } from 'jspdf'
import { marked } from 'marked'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const mdRel = process.argv[2] || 'MANUAL_PROCESOS_ESTADOS.md'
const pdfRel =
  process.argv[3] || mdRel.replace(/\.md$/i, '.pdf')

const mdPath = join(root, mdRel)
const pdfPath = join(root, pdfRel)

/** Texto plano desde tokens inline (negritas, etc.) */
function inlineToText(tokens) {
  if (!tokens || !tokens.length) return ''
  let out = ''
  for (const t of tokens) {
    if (t.type === 'text' || t.type === 'escape') out += t.raw || t.text || ''
    else if (t.type === 'strong') out += inlineToText(t.tokens || [{ type: 'text', text: t.text }])
    else if (t.type === 'em') out += inlineToText(t.tokens || [{ type: 'text', text: t.text }])
    else if (t.type === 'codespan') out += t.text || ''
    else if (t.raw) out += t.raw
  }
  return out.trim()
}

const md = readFileSync(mdPath, 'utf8')
const tokens = marked.lexer(md)

const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
const pageH = doc.internal.pageSize.getHeight()
const pageW = doc.internal.pageSize.getWidth()
const margin = 48
const maxW = pageW - margin * 2
let y = margin

function newPage() {
  doc.addPage()
  y = margin
}

function ensureSpace(need) {
  if (y + need > pageH - margin) newPage()
}

function writeParagraph(text, fontSize, bold) {
  if (!text) return
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(fontSize)
  const wrapped = doc.splitTextToSize(text, maxW)
  const lineH = fontSize * 1.35
  ensureSpace(wrapped.length * lineH + 4)
  for (const line of wrapped) {
    if (y + lineH > pageH - margin) newPage()
    doc.text(line, margin, y)
    y += lineH
  }
  y += fontSize * 0.4
}

for (const t of tokens) {
  switch (t.type) {
    case 'heading': {
      const text = inlineToText(t.tokens) || t.raw.replace(/^#+\s*/, '').trim()
      const size = t.depth === 1 ? 15 : t.depth === 2 ? 12 : 11
      y += t.depth <= 2 ? 12 : 8
      writeParagraph(text, size, true)
      break
    }
    case 'paragraph': {
      const text = inlineToText(t.tokens) || t.text || t.raw
      writeParagraph(text, 10, false)
      break
    }
    case 'list': {
      for (const item of t.items || []) {
        const raw = inlineToText(item.tokens) || item.text || ''
        const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
        for (const line of lines) {
          writeParagraph(`• ${line}`, 10, false)
        }
      }
      break
    }
    case 'table': {
      const header = (t.header || []).map((c) => inlineToText(c.tokens)).join('  |  ')
      if (header) writeParagraph(header, 10, true)
      for (const row of t.rows || []) {
        const line = row.map((c) => inlineToText(c.tokens)).join('  |  ')
        writeParagraph(line, 9, false)
      }
      y += 6
      break
    }
    case 'hr':
      y += 14
      break
    case 'space':
      y += 6
      break
    default:
      break
  }
}

writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')))
console.log('PDF generado:', pdfPath)
