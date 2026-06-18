import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sql = fs.readFileSync(
  path.join(root, 'supabase/patches/2026-06-18_import_lista_precios_flexxus.sql'),
  'utf8'
)
const outDir = path.join(root, 'Postulantes/_mcp_queries')
fs.mkdirSync(outDir, { recursive: true })

const m = sql.match(
  /INSERT INTO _import_lista_flexxus[\s\S]*?VALUES\s*([\s\S]*?);\s*\n-- Actualizar/
)
if (!m) throw new Error('No se encontró bloque VALUES')

const raw = m[1].trim()
const tuples = []
let depth = 0
let start = -1
for (let i = 0; i < raw.length; i++) {
  const ch = raw[i]
  if (ch === '(') {
    if (depth === 0) start = i
    depth++
  } else if (ch === ')') {
    depth--
    if (depth === 0 && start >= 0) {
      tuples.push(raw.slice(start, i + 1))
      start = -1
    }
  }
}

const header = `INSERT INTO public.articulos_empresa (
  codigo, nombre, categoria,
  precio_lista_1, precio_lista_2, precio_lista_3, precio_lista_4, precio_lista_5,
  precio_base, activo, visible_clientes, requiere_archivos
) VALUES
`

const footer = `
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  categoria = COALESCE(EXCLUDED.categoria, articulos_empresa.categoria),
  precio_lista_1 = EXCLUDED.precio_lista_1,
  precio_lista_2 = EXCLUDED.precio_lista_2,
  precio_lista_3 = EXCLUDED.precio_lista_3,
  precio_lista_4 = EXCLUDED.precio_lista_4,
  precio_lista_5 = EXCLUDED.precio_lista_5,
  precio_base = COALESCE(EXCLUDED.precio_base, articulos_empresa.precio_base),
  activo = true,
  updated_at = now();`

const chunkSize = 50
let batch = 0
for (let i = 0; i < tuples.length; i += chunkSize) {
  const chunk = tuples.slice(i, i + chunkSize)
  const values = chunk
    .map((t) => {
      const inner = t.slice(1, -1).trimEnd()
      return `(${inner}, true, false, false)`
    })
    .join(',\n')
  const q = header + values + footer
  fs.writeFileSync(
    path.join(outDir, `lista_precios_batch_${String(batch).padStart(2, '0')}.sql`),
    q
  )
  batch++
}

console.log(`Wrote ${batch} batches (${tuples.length} artículos)`)
