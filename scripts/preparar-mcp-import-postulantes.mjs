import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const inDir = join(root, 'Postulantes', '_json_batches')
const outDir = join(root, 'Postulantes', '_mcp_queries')
mkdirSync(outDir, { recursive: true })

const files = readdirSync(inDir).filter((f) => f.endsWith('.json')).sort()
files.forEach((f, i) => {
  const json = readFileSync(join(inDir, f), 'utf8')
  const sql = `SELECT public.rrhh_importar_postulaciones_legacy($json$${json}$json$::jsonb) AS imported;`
  writeFileSync(join(outDir, `query_${String(i).padStart(3, '0')}.sql`), sql, 'utf8')
})
console.log(`Queries: ${files.length}`)
