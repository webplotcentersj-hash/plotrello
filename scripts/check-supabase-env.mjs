import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const env = loadEnv('.env')
const url = env.VITE_SUPABASE_URL || ''
const key = env.VITE_SUPABASE_ANON_KEY || ''

console.log('url_ok:', /^https:\/\/.+\.supabase\.co\/?$/.test(url))
console.log('key_set:', key.length > 20)
console.log('key_format:', key.startsWith('eyJ') ? 'jwt' : key.startsWith('sb_') ? 'publishable' : 'other')

if (!url || key.length < 20) {
  console.log('fix: configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const sb = createClient(url, key)
const { error } = await sb.rpc('autenticar_cliente', {
  p_usuario: '__probe__',
  p_password: 'x'
})

if (!error) {
  console.log('rpc_reachable: true')
  process.exit(0)
}

const msg = error.message || String(error)
console.log('rpc_reachable:', !/fetch|network|invalid api key|jwt/i.test(msg))
console.log('rpc_msg:', msg)
