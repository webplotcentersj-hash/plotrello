/**
 * Importa postulantes legacy vía RPC rrhh_importar_postulaciones_legacy (anon key).
 * Lee Postulantes/_json_batches/batch_*.json
 *
 * Uso: node scripts/importar-postulantes-anon.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const SUPABASE_URL = 'https://bwdtrzcdzbzrtykjzber.supabase.co'
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZHRyemNkemJ6cnR5a2p6YmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDg1MTMsImV4cCI6MjA3OTEyNDUxM30.SSK0LDS0Y5XP-BdCzhtCeEKe0Iq7A2ArYnAcwCA6ebk'

const batchesDir = join(root, 'Postulantes', '_json_batches')
const statusPath = join(root, 'Postulantes', '_import_status.txt')

const supabase = createClient(SUPABASE_URL, ANON_KEY)

function listBatches() {
  return readdirSync(batchesDir)
    .filter((f) => f.startsWith('batch_') && f.endsWith('.json'))
    .sort()
}

async function getCount() {
  const { count, error } = await supabase
    .from('rrhh_postulaciones')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function main() {
  const batches = listBatches()
  if (!batches.length) {
    console.error('No hay batches en', batchesDir)
    process.exit(1)
  }

  let countBefore = 0
  try {
    countBefore = await getCount()
    console.log(`Count before: ${countBefore}`)
  } catch (e) {
    console.warn('Count before:', e.message)
  }

  const failed = []
  let totalImported = 0

  for (const file of batches) {
    const path = join(batchesDir, file)
    const rows = JSON.parse(readFileSync(path, 'utf8'))
    const { data, error } = await supabase.rpc('rrhh_importar_postulaciones_legacy', {
      p_rows: rows
    })
    if (error) {
      failed.push({ file, error: error.message })
      console.error(`FAIL ${file}:`, error.message)
      continue
    }
    totalImported += Number(data) || 0
    console.log(`OK ${file} → rpc returned ${data}`)
  }

  let countAfter = 0
  try {
    countAfter = await getCount()
  } catch (e) {
    console.warn('Count after:', e.message)
  }

  const summary = [
    `Finished: ${new Date().toISOString()}`,
    `Method: anon RPC rrhh_importar_postulaciones_legacy`,
    `Batches OK: ${batches.length - failed.length}/${batches.length}`,
    `RPC rows processed (sum): ${totalImported}`,
    `rrhh_postulaciones COUNT before: ${countBefore}`,
    `rrhh_postulaciones COUNT after: ${countAfter}`,
    `Net new rows: ${countAfter - countBefore}`,
    '',
    failed.length ? 'Failed:' : 'All batches succeeded.',
    ...failed.map((f) => `  - ${f.file}: ${f.error}`)
  ].join('\n')

  writeFileSync(statusPath, summary, 'utf8')
  console.log('\n' + summary)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  writeFileSync(statusPath, String(e.stack || e.message), 'utf8')
  console.error(e)
  process.exit(1)
})
