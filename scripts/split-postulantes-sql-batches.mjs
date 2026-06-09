import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'Postulantes', '_import_postulantes.sql')
const outDir = join(root, 'Postulantes', '_batches')
const BATCH = 20

const content = readFileSync(src, 'utf8')
const inserts = content
  .split(/(?=INSERT INTO public\.rrhh_postulaciones)/)
  .map((s) => s.trim())
  .filter((s) => s.startsWith('INSERT INTO'))
mkdirSync(outDir, { recursive: true })

let batchIdx = 0
for (let i = 0; i < inserts.length; i += BATCH) {
  const chunk = inserts.slice(i, i + BATCH)
  const sql = 'BEGIN;\n' + chunk.join('\n') + '\nCOMMIT;'
  const path = join(outDir, `batch_${String(batchIdx).padStart(3, '0')}.sql`)
  writeFileSync(path, sql, 'utf8')
  batchIdx++
}

console.log(`Batches: ${batchIdx} (${inserts.length} inserts)`)
