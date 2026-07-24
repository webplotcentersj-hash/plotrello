/**
 * Aplica supabase/patches/2026-07-24_rrhh_sabado_medio.sql
 * Uso: node scripts/apply_rrhh_sabado_medio.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Falta VITE_SUPABASE_URL / SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const sqlPath = join(root, 'supabase', 'patches', '2026-07-24_rrhh_sabado_medio.sql')
const sql = readFileSync(sqlPath, 'utf8')
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function tryExecSql(query) {
  const attempts = [
    () => sb.rpc('exec_sql', { sql: query }),
    () => sb.rpc('exec_sql', { query }),
    () =>
      fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: query })
      }).then(async (res) => {
        const text = await res.text()
        if (!res.ok) return { data: null, error: { message: text || String(res.status) } }
        return { data: text, error: null }
      })
  ]
  for (const fn of attempts) {
    try {
      const r = await fn()
      if (!r.error) return { ok: true, data: r.data }
      console.log('exec_sql intento:', r.error.message?.slice?.(0, 160) || r.error)
    } catch (e) {
      console.log('exec_sql fail:', e instanceof Error ? e.message : e)
    }
  }
  return { ok: false }
}

async function main() {
  console.log('Aplicando 2026-07-24_rrhh_sabado_medio.sql …')
  const exec = await tryExecSql(sql)
  if (exec.ok) {
    console.log('OK vía exec_sql')
  } else {
    console.log('exec_sql no disponible; verificando si la tabla ya existe…')
  }

  const { error } = await sb.from('rrhh_sabado_medio').select('id_usuario').limit(1)
  if (!error) {
    // Asegurar RPCs: si la tabla existe pero faltan funciones, reintentar solo funciones
    if (!exec.ok) {
      const fnSql = sql
        .split('COMMIT;')[0]
        .replace(/^[\s\S]*GRANT SELECT[\s\S]*?;/m, '') // rough; better re-run full if possible
      void fnSql
      console.log(
        'Tabla rrhh_sabado_medio OK. Si faltan RPCs, corré el SQL completo en el SQL Editor de Supabase.'
      )
    }
    const { error: rpcErr } = await sb.rpc('obtener_sabados_medio')
    if (rpcErr) {
      console.error('RPC obtener_sabados_medio falta:', rpcErr.message)
      console.error('Abrí SQL Editor y ejecutá:', sqlPath)
      process.exit(1)
    }
    console.log('Verificado: tabla + obtener_sabados_medio OK')
    process.exit(0)
  }

  console.error('Tabla ausente:', error.message)
  console.error('Ejecutá manualmente en SQL Editor de Supabase:')
  console.error(sqlPath)
  process.exit(1)
}

main()
