import type { jsPDF } from 'jspdf'

/** Solo para tests: texto, imágenes y páginas de un PDF generado, leídos con pdf.js. */
export async function leerPdf(doc: jsPDF) {
  const ruta = 'pdfjs-dist/legacy/build/pdf.mjs' // import dinámico: la ruta legacy no trae tipos
  const pdfjs = await import(ruta)
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(doc.output('arraybuffer')), useSystemFonts: true, verbosity: 0 }).promise
  let texto = ''
  let imagenes = 0
  const porPagina: string[] = []
  let xMin = Infinity
  let xMax = -Infinity
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n)
    const contenido = await pagina.getTextContent()
    const items = (contenido.items as Array<{ str: string; transform: number[]; width: number }>).filter((i) => i.str.trim())
    for (const i of items) {
      xMin = Math.min(xMin, i.transform[4])
      xMax = Math.max(xMax, i.transform[4] + i.width)
    }
    const t = items.map((i) => i.str).join(' ')
    porPagina.push(t.replace(/\s+/g, ' ').trim())
    texto += ' ' + t
    const ops = await pagina.getOperatorList()
    imagenes += ops.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject).length
  }
  return { texto: texto.replace(/\s+/g, ' ').trim(), porPagina, imagenes, paginas: pdf.numPages as number, xMin, xMax }
}

export function assertContiene(assert: { ok: (v: unknown, m?: string) => void }, texto: string, esperados: string[]) {
  for (const e of esperados) assert.ok(texto.includes(e), `falta "${e}" en: ${texto.slice(0, 600)}…`)
}
