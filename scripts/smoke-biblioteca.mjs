/**
 * Smoke test: biblioteca count, búsqueda server-side y catálogo paginado.
 * Uso: node scripts/smoke-biblioteca.mjs
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const f of ['.env.local', '.env']) {
  const p = resolve(root, f)
  if (existsSync(p)) dotenv.config({ path: p })
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const PAGE = 400

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const sb = createClient(url, key)
const selectCols = 'id,numero_op,cliente,descripcion,estado,fecha_creacion'

async function main() {
  const t0 = Date.now()
  console.log('=== Smoke biblioteca ===\n')

  const { count, error: countErr } = await sb
    .from('ordenes_trabajo')
    .select('id', { count: 'exact', head: true })
  if (countErr) {
    console.error('FAIL count:', countErr.message)
    process.exit(1)
  }
  console.log(`OK getOrdenesBibliotecaCount → ${count} OP`)

  const searchTerm = '100'
  const pattern = `%${searchTerm}%`
  const { data: searchRows, error: searchErr } = await sb
    .from('ordenes_trabajo')
    .select(selectCols)
    .or(`numero_op.ilike.${pattern},cliente.ilike.${pattern}`)
    .order('fecha_creacion', { ascending: false })
    .limit(50)
  if (searchErr) {
    console.error('FAIL search:', searchErr.message)
    process.exit(1)
  }
  console.log(`OK searchOrdenesBiblioteca("${searchTerm}") → ${searchRows?.length ?? 0} filas`)
  if (searchRows?.[0]) {
    console.log(`   primera: OP ${searchRows[0].numero_op} · ${searchRows[0].cliente}`)
  }

  let loaded = 0
  let offset = 0
  let pages = 0
  for (;;) {
    const from = offset
    const to = offset + PAGE - 1
    const { data, error } = await sb
      .from('ordenes_trabajo')
      .select('id')
      .order('id', { ascending: false })
      .range(from, to)
    if (error) {
      console.error('FAIL catalog page:', error.message)
      process.exit(1)
    }
    const page = data ?? []
    if (page.length === 0) break
    loaded += page.length
    pages += 1
    offset += page.length
    if (page.length < PAGE) break
  }

  const overOldCap = loaded > 2200
  console.log(`OK catálogo paginado → ${loaded} OP en ${pages} página(s)`)
  console.log(`   supera tope viejo (2200): ${overOldCap ? 'sí ✓' : 'no'}`)
  console.log(`   coincide con count: ${loaded === count ? 'sí ✓' : `no (${loaded} vs ${count})`}`)
  console.log(`\nTiempo total: ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
