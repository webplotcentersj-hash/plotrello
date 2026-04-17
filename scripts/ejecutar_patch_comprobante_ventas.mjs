/**
 * Aplica supabase/patches/2026-04-17_ventas_comprobante_pago_url.sql vía RPC exec_sql (service role).
 * Requiere en .env (raíz del repo): VITE_SUPABASE_URL real y VITE_SUPABASE_SERVICE_ROLE_KEY.
 * Uso: node scripts/ejecutar_patch_comprobante_ventas.mjs
 */
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env') })

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY

const sqlPath = join(root, 'supabase', 'patches', '2026-04-17_ventas_comprobante_pago_url.sql')

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

if (supabaseUrl.includes('your-project.supabase.co')) {
  console.error(
    'VITE_SUPABASE_URL apunta al placeholder del ejemplo. Configurá la URL real del proyecto en .env y volvé a ejecutar.'
  )
  process.exit(1)
}

const sql = readFileSync(sqlPath, 'utf8')

let response
try {
  response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ sql })
  })
} catch (e) {
  console.error('No se pudo conectar a Supabase:', e.cause?.message || e.message)
  process.exit(1)
}

const text = await response.text()
if (!response.ok) {
  console.error('Error HTTP', response.status, text)
  if (response.status === 404) {
    console.error(
      'Si ves 404, puede que no exista la función RPC public.exec_sql en tu proyecto. En ese caso ejecutá el SQL manualmente en el SQL Editor de Supabase.'
    )
  }
  process.exit(1)
}

console.log('OK:', text || '(sin cuerpo)')
