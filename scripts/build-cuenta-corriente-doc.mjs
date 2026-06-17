/**
 * Genera docs/CUENTA_CORRIENTE_PLOT_LAB.html y PDF
 * Uso: node scripts/build-cuenta-corriente-doc.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { doc, diagrams } from './cuenta-corriente-doc-data.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const htmlOut = join(root, 'docs', 'CUENTA_CORRIENTE_PLOT_LAB.html')
const pdfOut = join(root, 'docs', 'CUENTA_CORRIENTE_PLOT_LAB.pdf')

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const css = `
:root { --accent: #c2410c; --border: #cbd5e1; --muted: #475569; --text: #0f172a; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "DM Sans", system-ui, sans-serif; background: #e2e8f0; color: var(--text); font-size: 12.5px; line-height: 1.55; }
@page { size: A4 portrait; margin: 12mm; }
@media print { body { background: #fff; } .sheet { box-shadow: none !important; page-break-after: always; } .sheet:last-child { page-break-after: auto; } .no-print { display: none !important; } .avoid-break { break-inside: avoid; } }
.toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 10px; background: #fff; border-bottom: 1px solid var(--border); }
.toolbar button { font: inherit; font-weight: 700; padding: 8px 16px; border-radius: 8px; border: none; background: var(--accent); color: #fff; cursor: pointer; }
.wrap { max-width: 820px; margin: 0 auto; padding: 16px 14px 40px; }
.sheet { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 24px 28px; margin-bottom: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.cover { text-align: center; padding: 40px 20px; border-top: 5px solid var(--accent); }
.cover h1 { margin: 10px 0; font-size: 1.85rem; font-weight: 800; }
.cover .subtitle { color: var(--muted); max-width: 560px; margin: 0 auto 16px; }
.route-pill { display: inline-block; font-family: ui-monospace, monospace; font-size: 0.72rem; padding: 4px 10px; margin: 4px; background: #f1f5f9; border: 1px solid var(--border); border-radius: 6px; }
h2 { margin: 0 0 12px; font-size: 1.15rem; font-weight: 800; border-bottom: 2px solid var(--accent); padding-bottom: 6px; }
h3 { margin: 14px 0 8px; font-size: 0.95rem; font-weight: 700; color: var(--accent); }
h4 { margin: 10px 0 6px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.problema { background: #fef3c7; border-left: 4px solid #d97706; padding: 12px 14px; margin-bottom: 12px; border-radius: 0 6px 6px 0; }
.problema-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #92400e; }
.block { margin-bottom: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; background: #f8fafc; }
.block p { margin: 0; }
.diagram-wrap { margin: 12px 0; padding: 10px; background: #fafafa; border: 1px solid var(--border); border-radius: 6px; }
.diagram-svg { width: 100%; height: auto; }
.flujo-block { margin-bottom: 14px; padding: 12px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px; }
.flujo-block h3 { margin-top: 0; color: #1d4ed8; }
.flujo-block ol { margin: 6px 0 0; padding-left: 20px; }
.flujo-block li { margin-bottom: 5px; font-size: 0.88rem; }
.card { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; background: #fafafa; }
.card strong { display: block; margin-bottom: 4px; }
.card ul { margin: 6px 0 0; padding-left: 18px; font-size: 0.85rem; color: var(--muted); }
table { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin: 8px 0; }
th, td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #fff7ed; font-weight: 700; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
.comp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.comp-item { padding: 8px; border: 1px solid var(--border); border-radius: 5px; font-size: 0.8rem; }
.comp-item strong { display: block; font-size: 0.78rem; }
.comp-item span { color: var(--muted); font-size: 0.75rem; }
`

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(doc.title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>${css}</style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">Imprimir / Guardar PDF</button>
    <span style="color:var(--muted)">${esc(doc.title)}</span>
  </div>
  <div class="wrap">
    <section class="sheet cover">
      <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.1em;color:var(--accent);text-transform:uppercase">Plot Lab · Mostrador</p>
      <h1>${esc(doc.title)}</h1>
      <p class="subtitle">${esc(doc.subtitle)}</p>
      ${doc.routes.map(([r, d]) => `<span class="route-pill">${esc(r)}</span>`).join('')}
    </section>

    <section class="sheet">
      <h2>Visión general</h2>
      <div class="problema avoid-break">
        <span class="problema-label">Problema que resuelve</span>
        <p>${esc(doc.problema)}</p>
      </div>
      <div class="block avoid-break"><h4>Cómo funciona</h4><p>${esc(doc.comoFunciona)}</p></div>
      <div class="block avoid-break" style="background:#f0fdf4;border-color:#bbf7d0"><h4>Quién lo usa</h4><p>${esc(doc.quienUsa)}</p></div>
      <h3>Rutas</h3>
      <table>
        <thead><tr><th>Ruta</th><th>Página / función</th></tr></thead>
        <tbody>${doc.routes.map(([r, d]) => `<tr><td><code>${esc(r)}</code></td><td>${esc(d)}</td></tr>`).join('')}</tbody>
      </table>
    </section>

    <section class="sheet">
      <h2>Diagramas de flujo</h2>
      <h3>Alta y aprobación</h3>
      <div class="diagram-wrap">${diagrams.alta}</div>
      <h3>Venta fiada en mostrador</h3>
      <div class="diagram-wrap">${diagrams.venta}</div>
      <h3>Libro de movimientos</h3>
      <div class="diagram-wrap">${diagrams.libro}</div>
    </section>

    <section class="sheet">
      <h2>Flujos paso a paso</h2>
      ${doc.flujos.map((f) => `<div class="flujo-block avoid-break"><h3>${esc(f.title)}</h3><ol>${f.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`).join('')}
    </section>

    <section class="sheet">
      <h2>Pantallas y componentes</h2>
      ${doc.pantallas.map((p) => `<div class="card avoid-break"><strong>${esc(p.name)}</strong><span style="color:var(--muted)">${esc(p.desc)}</span><ul>${p.detalles.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>`).join('')}
      <h3>Componentes React</h3>
      <div class="comp-grid">${doc.componentes.map((c) => `<div class="comp-item"><strong>${esc(c.name)}</strong><span>${esc(c.desc)}</span></div>`).join('')}</div>
    </section>

    <section class="sheet">
      <h2>Estados, scoring y documentación</h2>
      <h3>Estados de la ficha</h3>
      <table>
        <thead><tr><th>Estado</th><th>Etiqueta</th><th>Efecto operativo</th></tr></thead>
        <tbody>${doc.estados.map((e) => `<tr><td><code>${esc(e.estado)}</code></td><td>${esc(e.label)}</td><td>${esc(e.efecto)}</td></tr>`).join('')}</tbody>
      </table>
      <h3>Niveles de scoring</h3>
      <table>
        <thead><tr><th>Nivel</th><th>Puntos</th><th>Uso en mostrador</th></tr></thead>
        <tbody>${doc.scoring.map((s) => `<tr><td>${esc(s.nivel)}</td><td>${esc(s.rango)}</td><td>${esc(s.uso)}</td></tr>`).join('')}</tbody>
      </table>
      <p style="font-size:0.85rem;color:var(--muted)">Admin puede ajustar score manualmente, fijar límite_credito distinto del sugerido y dejar notas internas. Tras cada venta o pago se invoca <code>calcular_scoring_cuenta_corriente</code>.</p>
      <h3>Documentación requerida en el alta</h3>
      <table>
        <thead><tr><th>Documento</th><th>Obligatorio</th><th>Campo BD</th></tr></thead>
        <tbody>${doc.documentos.map((d) => `<tr><td>${esc(d.doc)}</td><td>${esc(d.obligatorio)}</td><td><code>${esc(d.storage)}</code></td></tr>`).join('')}</tbody>
      </table>
    </section>

    <section class="sheet">
      <h2>Intereses, pagos y exportaciones</h2>
      <div class="card avoid-break">
        <strong>Intereses y mora (CuentaCorrienteInteresesPanel)</strong>
        <ul>
          <li>Administración define % interés mensual pactado y % mora (pueden diferir).</li>
          <li>Días de gracia antes de aplicar mora.</li>
          <li>Cálculo proporcional por días vencidos (base 30 días).</li>
          <li>cc_registrar_intereses_devengados genera cargos en el libro por período.</li>
        </ul>
      </div>
      <div class="card avoid-break">
        <strong>Registro de pagos</strong>
        <ul>
          <li>Comprobante obligatorio (transferencia, depósito) — subida a Storage.</li>
          <li>Vinculación opcional a venta CC pendiente; aviso si pago parcial.</li>
          <li>Actualiza saldo, movimientos y scoring automáticamente.</li>
        </ul>
      </div>
      <div class="card avoid-break">
        <strong>Pagaré (persona física)</strong>
        <ul>
          <li>PDF generado con jsPDF: monto en letras, vencimiento, domicilio, tasas pactadas.</li>
          <li>buildPagareCuentaCorrienteDoc / generarYGuardarPagareCuentaCorriente.</li>
          <li>Se almacena url_pagare en la ficha.</li>
        </ul>
      </div>
      <h3>Exportaciones</h3>
      <ul>${doc.exports.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    </section>

    <section class="sheet">
      <h2>Base de datos, RPCs e integraciones</h2>
      <h3>Tablas principales</h3>
      <table>
        <thead><tr><th>Tabla</th><th>Contenido</th></tr></thead>
        <tbody>${doc.tablas.map((t) => `<tr><td><code>${esc(t.tabla)}</code></td><td>${esc(t.campos)}</td></tr>`).join('')}</tbody>
      </table>
      <h3>Funciones RPC (Supabase)</h3>
      <table>
        <thead><tr><th>RPC</th><th>Uso</th></tr></thead>
        <tbody>${doc.rpcs.map((r) => `<tr><td><code>${esc(r.rpc)}</code></td><td>${esc(r.uso)}</td></tr>`).join('')}</tbody>
      </table>
      <h3>Integraciones con otros módulos</h3>
      <ul>${doc.integraciones.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <p style="margin-top:16px;font-size:0.75rem;color:var(--muted);text-align:center">Plot Lab · ${esc(doc.title)} · Junio 2026</p>
    </section>
  </div>
</body>
</html>`

writeFileSync(htmlOut, html, 'utf8')
console.log('HTML:', htmlOut)

const fileUrl = 'file:///' + htmlOut.replace(/\\/g, '/')
const candidates = [
  join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
]

for (const bin of candidates) {
  if (!existsSync(bin)) continue
  const r = spawnSync(bin, ['--headless=new', '--disable-gpu', `--print-to-pdf=${pdfOut}`, fileUrl], { stdio: 'inherit' })
  if (r.status === 0 && existsSync(pdfOut)) {
    console.log('PDF:', pdfOut)
    process.exit(0)
  }
}
console.log('PDF manual: abrir HTML e imprimir')
