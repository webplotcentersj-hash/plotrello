import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

export function buildWhatsappLinkFromPhone(phone) {
  if (!phone) return ''
  const raw = String(phone).trim()
  if (!raw || raw === '-' || /^desconocido$/i.test(raw)) return ''

  const chunk = raw.split(/\s+-\s+|\(/)[0].trim()
  const digits = chunk.replace(/\D/g, '')
  if (digits.length < 8) return ''

  let normalized = digits
  if (normalized.startsWith('0')) normalized = normalized.slice(1)

  if (!raw.startsWith('+') && !normalized.startsWith('54')) {
    normalized = `54${normalized}`
  }

  return `https://wa.me/${normalized}`
}

function esc(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

const csvPath = path.join(root, 'docs', 'listado_clientes_telefonos.csv')
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter(Boolean)
const header = parseCsvLine(lines[0])

const telIdx = header.indexOf('telefono')
if (telIdx === -1) {
  console.error('Columna telefono no encontrada')
  process.exit(1)
}

const hasWhatsapp = header.includes('whatsapp')
const baseHeader = hasWhatsapp
  ? ['id', 'cliente', 'apellido', 'telefono', 'whatsapp', 'email', 'activo']
  : [...header, 'whatsapp']
const outLines = [baseHeader.join(',')]

for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i])
  const byName = Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? '']))
  const telefono = byName.telefono ?? ''
  const whatsapp = buildWhatsappLinkFromPhone(telefono)
  const row = [
    byName.id,
    byName.cliente,
    byName.apellido,
    telefono,
    whatsapp,
    byName.email,
    byName.activo
  ]
  outLines.push(row.map(esc).join(','))
}

fs.writeFileSync(csvPath, `\ufeff${outLines.join('\n')}`, 'utf8')

const conLink = outLines.length - 1 - outLines.slice(1).filter((l) => l.endsWith(',') || /,""$/.test(l)).length
const links = outLines.slice(1).filter((l) => /wa\.me/.test(l)).length
console.log(`Actualizado: ${csvPath}`)
console.log(`Filas con link WhatsApp: ${links}`)
