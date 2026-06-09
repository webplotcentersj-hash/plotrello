/**
 * Ejecuta query_000.sql … query_022.sql (import legacy postulantes) vía exec_sql o Postgres.
 * Uso: node scripts/aplicar-todos-postulantes-local.mjs
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env') })

const PLACEHOLDER_HOST = 'your-project.supabase.co'
const DEFAULT_URL = 'https://bwdtrzcdzbzrtykjzber.supabase.co'

function resolveSupabaseUrl() {
  let url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_URL
  if (!url || url.includes(PLACEHOLDER_HOST)) url = DEFAULT_URL
  return url.replace(/\/$/, '')
}

function resolveServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  )
}

const supabaseUrl = resolveSupabaseUrl()
const serviceKey = resolveServiceKey()

const queriesDir = join(root, 'Postulantes', '_mcp_queries')
const statusPath = join(root, 'Postulantes', '_import_status.txt')

const UNIQUE_CONSTRAINT_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rrhh_postulaciones_legacy_id_key'
  ) THEN
    ALTER TABLE public.rrhh_postulaciones
      ADD CONSTRAINT rrhh_postulaciones_legacy_id_key UNIQUE (legacy_id);
  END IF;
END $$;
`.trim()

async function getPgClient() {
  const conn =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL
  if (!conn) return null
  try {
    const pg = await import('pg')
    const client = new pg.default.Client({ connectionString: conn })
    await client.connect()
    return client
  } catch {
    return null
  }
}

async function execViaRpc(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ sql })
  })
  const text = await response.text()
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
    err.status = response.status
    throw err
  }
  return text
}

async function execSql(sql, pgClient) {
  if (pgClient) {
    const res = await pgClient.query(sql)
    return res.rows
  }
  return execViaRpc(sql)
}

function listQueryFiles() {
  const files = []
  for (let i = 0; i <= 22; i++) {
    files.push(join(queriesDir, `query_${String(i).padStart(3, '0')}.sql`))
  }
  return files
}

async function getCount(supabase, pgClient) {
  if (pgClient) {
    const r = await pgClient.query('SELECT COUNT(*)::int AS c FROM public.rrhh_postulaciones')
    return r.rows[0]?.c ?? 0
  }
  const { count, error } = await supabase
    .from('rrhh_postulaciones')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function main() {
  const keyLooksValid =
    serviceKey.startsWith('eyJ') && serviceKey.length > 100 && !serviceKey.includes('your-')
  if (!keyLooksValid) {
    const msg = [
      'IMPORT ABORTED: invalid or missing service role key.',
      '',
      'Fix .env at repo root:',
      `  VITE_SUPABASE_URL=${DEFAULT_URL}`,
      '  VITE_SUPABASE_SERVICE_ROLE_KEY=<service_role secret from Supabase Dashboard → Settings → API>',
      '  (or SUPABASE_SERVICE_ROLE_KEY)',
      '',
      `URL used: ${supabaseUrl}`,
    ].join('\n')
    writeFileSync(statusPath, msg, 'utf8')
    console.error(msg)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const pgClient = await getPgClient()
  if (pgClient) console.log('Using direct Postgres connection')
  else console.log('Using Supabase RPC exec_sql')

  const failed = []
  let authFailed = false

  try {
    await execSql(UNIQUE_CONSTRAINT_SQL, pgClient)
    console.log('UNIQUE constraint rrhh_postulaciones_legacy_id_key: OK (or already exists)')
  } catch (e) {
    console.warn('UNIQUE constraint step:', e.message)
    if (e.status === 401 || e.status === 403) authFailed = true
  }

  let countBefore = 0
  try {
    countBefore = await getCount(supabase, pgClient)
    console.log(`Count before: ${countBefore}`)
  } catch (e) {
    console.warn('Could not read count before:', e.message)
  }

  const files = listQueryFiles()
  let ok = 0

  for (const file of files) {
    const name = file.split(/[/\\]/).pop()
    if (!existsSync(file)) {
      failed.push({ file: name, error: 'file not found' })
      continue
    }
    const sql = readFileSync(file, 'utf8').trim()
    if (!sql) {
      failed.push({ file: name, error: 'empty file' })
      continue
    }
    try {
      const result = await execSql(sql, pgClient)
      ok++
      const preview =
        typeof result === 'string'
          ? result.slice(0, 120)
          : JSON.stringify(result?.[0] ?? result).slice(0, 120)
      console.log(`OK ${name} (${readFileSync(file).length} bytes) ${preview}`)
    } catch (e) {
      failed.push({ file: name, error: e.message })
      console.error(`FAIL ${name}:`, e.message)
      if (e.status === 401 || e.status === 403) authFailed = true
    }
  }

  let countAfter = 0
  try {
    countAfter = await getCount(supabase, pgClient)
  } catch (e) {
    console.warn('Could not read count after:', e.message)
  }

  const importedDelta = countAfter - countBefore
  const summary = [
    `Finished: ${new Date().toISOString()}`,
    `Supabase URL: ${supabaseUrl}`,
    `Batches OK: ${ok}/${files.length}`,
    `Batches failed: ${failed.length}`,
    `rrhh_postulaciones COUNT before: ${countBefore}`,
    `rrhh_postulaciones COUNT after: ${countAfter}`,
    `Net new rows (after - before): ${importedDelta}`,
    '',
    failed.length ? 'Failed batches:' : 'All batches succeeded.',
    ...failed.map((f) => `  - ${f.file}: ${f.error}`),
    '',
    authFailed
      ? [
          'AUTH FIX (.env):',
          '  Set VITE_SUPABASE_URL to your project URL (not your-project.supabase.co).',
          '  Set VITE_SUPABASE_SERVICE_ROLE_KEY to the service_role key (not anon).',
          '  Dashboard: https://supabase.com/dashboard/project/_/settings/api',
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  writeFileSync(statusPath, summary, 'utf8')
  console.log('\n' + summary)

  if (pgClient) await pgClient.end()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  writeFileSync(statusPath, String(e.stack || e.message), 'utf8')
  console.error(e)
  process.exit(1)
})
