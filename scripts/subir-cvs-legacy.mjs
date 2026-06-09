/**
 * Sube CVs locales a Storage (bucket archivos/cv-postulaciones/legacy_*).
 * No requiere service_role si la política anon del bucket archivos está activa.
 *
 * Uso:
 *   node scripts/subir-cvs-legacy.mjs
 *   node scripts/subir-cvs-legacy.mjs --dry-run
 *   node scripts/subir-cvs-legacy.mjs --limit=10
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : 0

const CV_DIR = join(root, 'Postulantes', 'uploads (1)', 'cv')
const statusPath = join(root, 'Postulantes', '_cv_upload_status.txt')

const SUPABASE_URL = 'https://bwdtrzcdzbzrtykjzber.supabase.co'
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZHRyemNkemJ6cnR5a2p6YmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDg1MTMsImV4cCI6MjA3OTEyNDUxM30.SSK0LDS0Y5XP-BdCzhtCeEKe0Iq7A2ArYnAcwCA6ebk'

const supabase = createClient(SUPABASE_URL, KEY)

function mimeFromName(name) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  return 'application/octet-stream'
}

async function fileExistsInStorage(path) {
  const folder = path.split('/').slice(0, -1).join('/')
  const name = basename(path)
  const { data, error } = await supabase.storage.from('archivos').list(folder, {
    search: name,
    limit: 5
  })
  if (error) return false
  return (data || []).some((f) => f.name === name)
}

async function main() {
  if (!existsSync(CV_DIR)) {
    console.error('No existe:', CV_DIR)
    process.exit(1)
  }

  const { data: rows, error } = await supabase
    .from('rrhh_postulaciones')
    .select('legacy_id, cv_nombre')
    .not('legacy_id', 'is', null)
    .order('legacy_id')

  if (error) {
    console.error('Error leyendo postulaciones:', error.message)
    process.exit(1)
  }

  let list = rows || []
  if (LIMIT > 0) list = list.slice(0, LIMIT)

  let uploaded = 0
  let skipped = 0
  let missing = 0
  let errors = 0

  for (const row of list) {
    const cvFilename = row.cv_nombre
    const localCv = join(CV_DIR, cvFilename)
    const storagePath = `cv-postulaciones/legacy_${row.legacy_id}_${cvFilename}`

    if (!cvFilename || !existsSync(localCv)) {
      missing++
      console.warn(`[${row.legacy_id}] CV local no encontrado: ${cvFilename}`)
      continue
    }

    if (!DRY_RUN) {
      const exists = await fileExistsInStorage(storagePath)
      if (exists) {
        skipped++
        continue
      }
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${storagePath}`)
      uploaded++
      continue
    }

    try {
      const fileBuf = readFileSync(localCv)
      const { error: upErr } = await supabase.storage.from('archivos').upload(storagePath, fileBuf, {
        upsert: true,
        contentType: mimeFromName(cvFilename),
        cacheControl: '31536000'
      })
      if (upErr) throw new Error(upErr.message)
      uploaded++
      if (uploaded % 50 === 0) console.log(`… ${uploaded} subidos`)
    } catch (e) {
      errors++
      console.error(`[${row.legacy_id}] ${cvFilename}:`, e.message)
      if (errors >= 3 && e.message.includes('row-level security')) {
        console.error('\nStorage RLS bloqueó la subida. Necesitás SUPABASE_SERVICE_ROLE_KEY en .env')
        break
      }
    }
  }

  const summary = [
    `Finished: ${new Date().toISOString()}`,
    `Postulaciones con legacy_id: ${list.length}`,
    `Subidos: ${uploaded}${DRY_RUN ? ' (dry-run)' : ''}`,
    `Ya en Storage (omitidos): ${skipped}`,
    `CV local no encontrado: ${missing}`,
    `Errores: ${errors}`
  ].join('\n')

  writeFileSync(statusPath, summary, 'utf8')
  console.log('\n' + summary)
  process.exit(errors ? 1 : 0)
}

main().catch((e) => {
  writeFileSync(statusPath, String(e.stack || e.message), 'utf8')
  console.error(e)
  process.exit(1)
})
