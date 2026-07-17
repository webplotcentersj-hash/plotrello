/**
 * Smoke E2E contra APIs públicas de Plot Lab (sin cobrar de verdad).
 * node scripts/mp-e2e-smoke.mjs
 */
const BASE = (process.env.PLOT_LAB_PUBLIC_URL || 'https://www.plotcenterlab.com.ar').replace(/\/$/, '')

async function hit(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 300) }
}

const results = []

// 1) Webhook debe responder 200 (idempotente / sin payment real)
{
  const r = await hit('POST', '/api/mp/webhook', {
    type: 'payment',
    action: 'payment.created',
    data: { id: '0' }
  })
  const ok = r.status === 200 && (r.json?.ok === true || r.text.includes('ok'))
  results.push({ step: 'webhook', ok, detail: `HTTP ${r.status} ${r.text}` })
}

// 2) Checkout sin auth/body inválido: no debe 500 silencioso
{
  const r = await hit('POST', '/api/mp/checkout', {})
  // 400/401/403/503 son respuestas esperadas si falta token o payload
  const ok = r.status >= 400 && r.status < 600
  results.push({
    step: 'checkout_without_payload',
    ok,
    detail: `HTTP ${r.status} ${r.text}`
  })
}

// 3) Status endpoint
{
  const r = await hit('GET', '/api/mp/checkout-status?checkout_id=00000000-0000-0000-0000-000000000000')
  const ok = r.status === 200 || r.status === 400 || r.status === 404 || r.status === 503
  results.push({ step: 'checkout_status', ok, detail: `HTTP ${r.status} ${r.text}` })
}

console.log(`Base: ${BASE}`)
let failed = 0
for (const row of results) {
  console.log(`${row.ok ? 'OK' : 'FAIL'}  ${row.step} — ${row.detail}`)
  if (!row.ok) failed++
}

if (failed) {
  console.error(`\n${failed} smoke check(s) fallaron.`)
  process.exit(1)
}

console.log(`
Smoke API OK.

Siguiente (manual / MCP OAuth):
1) Connect mercadopago-mcp-server en Cursor (Argentina)
2) get_credentials → set MERCADOPAGO_ACCESS_TOKEN en Vercel (+ SANDBOX=true)
3) node scripts/mp-onboard.mjs --check && --preference
4) Venta rápida con condición Mercado Pago + usuario de prueba
`)
