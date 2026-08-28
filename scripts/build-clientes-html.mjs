import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

function escHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const csvPath = path.join(root, 'docs', 'listado_clientes_telefonos.csv')
const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
const lines = raw.split(/\r?\n/).filter(Boolean)
const header = parseCsvLine(lines[0])

const rows = lines.slice(1).map((line) => {
  const cols = parseCsvLine(line)
  return Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? '']))
})

const conTel = rows.filter((r) => r.telefono?.trim()).length
const conWa = rows.filter((r) => r.whatsapp?.includes('wa.me')).length

const tbody = rows
  .map((r) => {
    const wa = r.whatsapp?.trim()
    const waCell = wa
      ? `<a class="wa" href="${escHtml(wa)}" target="_blank" rel="noopener">WhatsApp</a>`
      : '<span class="muted">—</span>'
    const email = r.email?.trim()
    const emailCell = email
      ? `<a href="mailto:${escHtml(email)}">${escHtml(email)}</a>`
      : '<span class="muted">—</span>'
    const activo = r.activo === 'si'
    return `<tr data-activo="${activo ? 'si' : 'no'}">
  <td>${escHtml(r.cliente)}</td>
  <td>${escHtml(r.apellido)}</td>
  <td>${escHtml(r.telefono)}</td>
  <td>${waCell}</td>
  <td>${emailCell}</td>
  <td><span class="badge ${activo ? 'on' : 'off'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
</tr>`
  })
  .join('\n')

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clientes — teléfonos y WhatsApp</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f8;
      --card: #fff;
      --text: #1a1f2e;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #25d366;
      --accent-dark: #1da851;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { margin: 0 0 6px; font-size: 1.5rem; }
    .meta { color: var(--muted); margin-bottom: 20px; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .toolbar input[type="search"] {
      flex: 1 1 240px;
      min-width: 200px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
    }
    .toolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      cursor: pointer;
      user-select: none;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }
    .table-wrap { overflow: auto; max-height: calc(100vh - 220px); }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #f9fafb;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--muted);
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    tbody tr:hover { background: #fafbfc; }
    tbody tr.hidden { display: none; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.wa {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff !important;
      font-weight: 600;
      font-size: 12px;
      text-decoration: none !important;
    }
    a.wa:hover { background: var(--accent-dark); }
    .muted { color: var(--muted); }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.on { background: #dcfce7; color: #166534; }
    .badge.off { background: #fee2e2; color: #991b1b; }
    .count { margin-left: auto; color: var(--muted); font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Clientes — teléfonos y WhatsApp</h1>
    <p class="meta">${rows.length} clientes · ${conTel} con teléfono · ${conWa} con link WhatsApp</p>
    <div class="toolbar">
      <input id="q" type="search" placeholder="Buscar por nombre, teléfono o email…" autofocus />
      <label><input id="soloWa" type="checkbox" /> Solo con WhatsApp</label>
      <label><input id="soloActivos" type="checkbox" checked /> Solo activos</label>
      <span class="count" id="visible">${rows.length} visibles</span>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Apellido</th>
              <th>Teléfono</th>
              <th>WhatsApp</th>
              <th>Email</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody id="rows">
${tbody}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    const q = document.getElementById('q')
    const soloWa = document.getElementById('soloWa')
    const soloActivos = document.getElementById('soloActivos')
    const visible = document.getElementById('visible')
    const trs = [...document.querySelectorAll('#rows tr')]

    function applyFilter() {
      const term = q.value.trim().toLowerCase()
      let n = 0
      for (const tr of trs) {
        const text = tr.textContent.toLowerCase()
        const hasWa = !!tr.querySelector('a.wa')
        const activo = tr.dataset.activo === 'si'
        const ok =
          (!term || text.includes(term)) &&
          (!soloWa.checked || hasWa) &&
          (!soloActivos.checked || activo)
        tr.classList.toggle('hidden', !ok)
        if (ok) n++
      }
      visible.textContent = n + ' visibles'
    }

    q.addEventListener('input', applyFilter)
    soloWa.addEventListener('change', applyFilter)
    soloActivos.addEventListener('change', applyFilter)
    applyFilter()
  </script>
</body>
</html>
`

const outPath = path.join(root, 'docs', 'listado_clientes_telefonos.html')
fs.writeFileSync(outPath, html, 'utf8')
console.log(`HTML: ${outPath} (${rows.length} filas)`)
