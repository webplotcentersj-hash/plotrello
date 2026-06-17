/**
 * Genera docs/esquema-plot-lab.html desde scripts/esquema-plot-lab-data.mjs
 * Uso: node scripts/build-esquema-plot-lab-html.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { meta, rolesTable, sections, diagrams } from './esquema-plot-lab-data.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs', 'esquema-plot-lab.html')

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sectionHtml(s) {
  const items = (s.items || [])
    .map(
      (i) => `<div class="module-card avoid-break">
        <strong>${esc(i.name)}</strong>
        <span class="card-desc">${esc(i.desc)}</span>
        ${i.detalle ? `<p class="card-detalle">${esc(i.detalle)}</p>` : ''}
      </div>`
    )
    .join('')

  const diagram = s.diagram && diagrams[s.diagram]
    ? `<div class="diagram-wrap avoid-break">${diagrams[s.diagram]}</div>`
    : ''

  const flujo = s.flujo?.length
    ? `<div class="block flujo avoid-break"><h4>Flujo típico</h4><ol>${s.flujo.map((f) => `<li>${esc(f)}</li>`).join('')}</ol></div>`
    : ''

  return `<section class="sheet" id="${s.id}">
    <h2><span class="num">${s.num}</span> ${esc(s.title)}</h2>
    <div class="problema avoid-break">
      <span class="problema-label">Problema que resuelve</span>
      <p>${esc(s.problema)}</p>
    </div>
    ${s.comoFunciona ? `<div class="block como avoid-break"><h4>Cómo funciona</h4><p>${esc(s.comoFunciona)}</p></div>` : ''}
    ${s.quienUsa ? `<div class="block quien avoid-break"><h4>Quién lo usa</h4><p>${esc(s.quienUsa)}</p></div>` : ''}
    ${flujo}
    ${diagram}
    <h4 class="funcs-title">Funciones y herramientas</h4>
    <div class="module-grid">${items}</div>
  </section>`
}

const rolesRows = rolesTable
  .map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`)
  .join('')

const toc = sections.map((s) => `<li><a href="#${s.id}">${s.num}. ${esc(s.title)}</a></li>`).join('')

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(meta.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root { --accent: #c2410c; --accent-light: #fff7ed; --border: #cbd5e1; --muted: #475569; --text: #0f172a; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "DM Sans", system-ui, sans-serif; background: #e2e8f0; color: var(--text); font-size: 12.5px; line-height: 1.55; }
    @page { size: A4 portrait; margin: 12mm; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none !important; page-break-after: always; break-after: page; }
      .sheet:last-child { page-break-after: auto; }
      .no-print { display: none !important; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
    }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 10px; background: #fff; border-bottom: 1px solid var(--border); }
    .toolbar button { font: inherit; font-weight: 700; padding: 8px 16px; border-radius: 8px; border: none; background: var(--accent); color: #fff; cursor: pointer; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 16px 14px 40px; }
    .sheet { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 24px 28px; margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .cover { text-align: center; padding: 40px 20px; border-top: 5px solid var(--accent); }
    .cover .badge { display: inline-block; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
    .cover h1 { margin: 10px 0; font-size: 1.9rem; font-weight: 800; letter-spacing: -0.03em; }
    .cover .subtitle { color: var(--muted); font-size: 0.95rem; max-width: 560px; margin: 0 auto 16px; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .pill { font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
    h2 { margin: 0 0 12px; font-size: 1.2rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    h2 .num { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; font-size: 0.8rem; background: var(--accent-light); color: var(--accent); border: 2px solid var(--accent); flex-shrink: 0; }
    h4 { margin: 0 0 6px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .funcs-title { margin: 14px 0 8px; }
    .problema { background: #fef3c7; border-left: 4px solid #d97706; padding: 10px 14px; margin-bottom: 10px; border-radius: 0 6px 6px 0; }
    .problema-label { display: block; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #92400e; margin-bottom: 4px; }
    .problema p { margin: 0; color: #334155; font-size: 0.9rem; }
    .block { margin-bottom: 10px; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border); }
    .block.como { background: #f8fafc; }
    .block.quien { background: #f0fdf4; border-color: #bbf7d0; }
    .block.flujo { background: #eff6ff; border-color: #bfdbfe; }
    .block p { margin: 0; color: #334155; font-size: 0.88rem; }
    .block ol { margin: 4px 0 0; padding-left: 18px; }
    .block li { margin-bottom: 3px; font-size: 0.85rem; color: #334155; }
    .module-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media (max-width: 640px) { .module-grid { grid-template-columns: 1fr; } }
    .module-card { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; background: #fafafa; }
    .module-card strong { display: block; font-size: 0.8rem; color: var(--text); margin-bottom: 2px; }
    .card-desc { font-size: 0.76rem; color: var(--muted); }
    .card-detalle { margin: 4px 0 0; font-size: 0.72rem; color: #64748b; line-height: 1.4; }
    .diagram-wrap { margin: 10px 0; padding: 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; }
    .diagram-svg { width: 100%; height: auto; display: block; }
    .toc { margin: 0; padding-left: 18px; columns: 2; column-gap: 24px; }
    .toc li { margin-bottom: 4px; break-inside: avoid; }
    .toc a { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.82rem; }
    .roles-table { width: 100%; border-collapse: collapse; font-size: 0.76rem; }
    .roles-table th, .roles-table td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
    .roles-table th { background: var(--accent-light); font-weight: 700; }
    footer.note { margin-top: 14px; text-align: center; font-size: 0.7rem; color: var(--muted); }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
    <span style="color:var(--muted)">${esc(meta.title)}</span>
  </div>
  <div class="wrap">
    <section class="sheet cover">
      <span class="badge">Plot Center · Documentación</span>
      <h1>Plot Lab<br/>Esquema completo del sistema</h1>
      <p class="subtitle">${esc(meta.subtitle)}</p>
      <div class="meta-row">
        <span class="pill">${esc(meta.domain)}</span>
        <span class="pill">Supabase + Vercel</span>
        <span class="pill">${esc(meta.version)}</span>
        <span class="pill">${sections.length} módulos documentados</span>
      </div>
    </section>

    <section class="sheet">
      <h2><span class="num">§</span> Índice</h2>
      <ol class="toc">${toc}</ol>
    </section>

    <section class="sheet" id="roles">
      <h2><span class="num">R</span> Roles y permisos</h2>
      <div class="problema avoid-break">
        <span class="problema-label">Problema que resuelve</span>
        <p>Cada empleado debe ver únicamente las pantallas de su función. Un cajero no necesita ERP; un operario externo no debe acceder al tablero de OPs ni a datos de otros clientes. Los permisos mal configurados generan fugas de información y errores operativos.</p>
      </div>
      <div class="block como avoid-break">
        <h4>Cómo funciona</h4>
        <p>El rol del usuario (tabla usuarios) determina flags en useAuth: isAdmin, canManageCaja, canManageWorkPool, etc. headerQuickNav y el menú del tablero muestran solo accesos permitidos. sectorPermissions filtra qué columnas del kanban ve cada sector.</p>
      </div>
      <table class="roles-table avoid-break">
        <thead><tr><th>Rol</th><th>Destino principal</th><th>Acceso destacado</th></tr></thead>
        <tbody>${rolesRows}</tbody>
      </table>
    </section>

    ${sections.map(sectionHtml).join('\n')}

    <footer class="note" style="padding:16px;text-align:center;color:#64748b;font-size:0.75rem">
      Regenerar: node scripts/build-esquema-plot-lab-html.mjs · node scripts/print-esquema-plot-lab-pdf.mjs
    </footer>
  </div>
</body>
</html>`

writeFileSync(out, html, 'utf8')
console.log('HTML generado:', out, `(${sections.length} secciones)`)
