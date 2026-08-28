import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildWhatsappLinkFromPhone } from './add-whatsapp-to-clientes-csv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const agentToolsDir = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.cursor',
  'projects',
  'c-Users-USUARIO-Desktop-Recue-Trello-7',
  'agent-tools'
)

const sourceFile = process.argv[2] || path.join(agentToolsDir, '1c85f7ad-51c1-458b-8cd9-363c488e6462.txt')

function parseMcpResult(raw) {
  let text = raw.trim()
  if (text.startsWith('{')) {
    const outer = JSON.parse(text)
    if (typeof outer.result === 'string') text = outer.result
  }
  const start = text.indexOf('[{"data"')
  if (start === -1) {
    const match = text.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*)\s*<\/untrusted-data-/i)
    if (!match) throw new Error('No clientes data block')
    return JSON.parse(match[1].trim())
  }
  const end = text.lastIndexOf('}]') + 2
  return JSON.parse(text.slice(start, end))
}

function esc(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const parsed = parseMcpResult(fs.readFileSync(sourceFile, 'utf8'))
const rows = parsed[0]?.data || parsed

if (!Array.isArray(rows)) {
  console.error('Formato inesperado en', sourceFile)
  process.exit(1)
}

rows.sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'))

const outPath = path.join(root, 'docs', 'listado_clientes_telefonos.csv')
const lines = ['id,cliente,apellido,telefono,whatsapp,email,activo']
for (const r of rows) {
  lines.push(
    [r.id, r.cliente, r.apellido, r.telefono, buildWhatsappLinkFromPhone(r.telefono), r.email, r.activo]
      .map(esc)
      .join(',')
  )
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `\ufeff${lines.join('\n')}`, 'utf8')

const conTel = rows.filter((r) => r.telefono && String(r.telefono).trim()).length
console.log(`Exportados: ${rows.length} clientes (${conTel} con teléfono)`)
console.log(`Archivo: ${outPath}`)
