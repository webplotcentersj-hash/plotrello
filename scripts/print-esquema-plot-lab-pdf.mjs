/**
 * Genera docs/ESQUEMA_PLOT_LAB.pdf desde docs/esquema-plot-lab.html
 * usando Chrome o Edge en modo headless (Windows).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const htmlPath = join(root, 'docs', 'esquema-plot-lab.html')
const outPdf = join(root, 'docs', 'ESQUEMA_PLOT_LAB.pdf')

if (!existsSync(htmlPath)) {
  console.error('No existe:', htmlPath)
  process.exit(1)
}

const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/')

const candidates = [
  join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
]

for (const bin of candidates) {
  if (!existsSync(bin)) continue
  const r = spawnSync(
    bin,
    ['--headless=new', '--disable-gpu', `--print-to-pdf=${outPdf}`, fileUrl],
    { stdio: 'inherit', shell: false }
  )
  if (r.status === 0 && existsSync(outPdf)) {
    console.log('PDF generado:', outPdf)
    process.exit(0)
  }
}

console.error('No se pudo generar el PDF automáticamente (Chrome/Edge no encontrado).')
console.error('Abrí en el navegador:', htmlPath)
console.error('y usá Imprimir → Guardar como PDF → A4.')
process.exit(1)
