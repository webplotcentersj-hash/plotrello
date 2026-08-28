import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildWhatsappLinkFromPhone } from './add-whatsapp-to-clientes-csv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL o clave en .env')
  process.exit(1)
}

const esc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const label = (r) => {
  const e = (r.empresa || '').trim()
  const n = (r.nombre || '').trim()
  return e || n || 'Sin nombre'
}

const rows = []
let from = 0
const page = 1000

while (true) {
  const endpoint =
    `${url}/rest/v1/clientes?select=id,nombre,apellido,empresa,telefono,email,activo` +
    `&order=nombre.asc&offset=${from}&limit=${page}`
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  })
  if (!res.ok) {
    console.error(await res.text())
    process.exit(1)
  }
  const batch = await res.json()
  if (!batch.length) break
  rows.push(...batch)
  if (batch.length < page) break
  from += page
}

rows.sort((a, b) => label(a).localeCompare(label(b), 'es'))

const outPath = path.join(root, 'docs', 'listado_clientes_telefonos.csv')
const lines = ['id,cliente,apellido,telefono,whatsapp,email,activo']
for (const r of rows) {
  lines.push(
    [r.id, label(r), r.apellido, r.telefono, buildWhatsappLinkFromPhone(r.telefono), r.email, r.activo !== false]
      .map(esc)
      .join(',')
  )
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `\ufeff${lines.join('\n')}`, 'utf8')

const conTel = rows.filter((r) => r.telefono && String(r.telefono).trim()).length
console.log(`Exportados: ${rows.length} clientes (${conTel} con teléfono)`)
console.log(`Archivo: ${outPath}`)
