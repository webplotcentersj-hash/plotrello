/**
 * Mercado Pago — onboarding / smoke helpers for Plot Lab.
 *
 * Uso:
 *   node scripts/mp-onboard.mjs                    # imprime checklist + URLs
 *   node scripts/mp-onboard.mjs --check            # valida token de env
 *   node scripts/mp-onboard.mjs --preference       # crea preference de prueba ($10)
 *   node scripts/mp-onboard.mjs --token APP_USR-…  # usa token explícito
 *
 * Env: MERCADOPAGO_ACCESS_TOKEN | MP_ACCESS_TOKEN
 * Webhook base: MERCADOPAGO_WEBHOOK_URL (default https://www.plotcenterlab.com.ar)
 */
import process from 'node:process'

const MP_API = 'https://api.mercadopago.com'
const DEFAULT_WEBHOOK_BASE = 'https://www.plotcenterlab.com.ar'

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return null
  return process.argv[i + 1] || null
}

function getToken() {
  return (
    argValue('--token') ||
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    ''
  ).trim()
}

function webhookBase() {
  return (process.env.MERCADOPAGO_WEBHOOK_URL || DEFAULT_WEBHOOK_BASE).replace(/\/$/, '')
}

function printChecklist() {
  const base = webhookBase()
  console.log(`
=== Plot Lab × Mercado Pago — checklist ===

1) Cursor MCP (OAuth)
   - Settings → Tools & MCPs → mercadopago-mcp-server → Connect
   - País: Argentina
   - Doc: https://www.mercadopago.com.ar/developers/es/docs/mcp-server/connection

2) Webhooks a registrar en la app MP
   - General / venta / portal: ${base}/api/mp/webhook
   - Tótem (legacy):         ${base}/api/totem/mp-webhook

3) Vercel (server env, NO VITE_)
   vercel env add MERCADOPAGO_ACCESS_TOKEN production
   vercel env add MERCADOPAGO_WEBHOOK_URL production
   # valor: ${base}
   vercel env add MERCADOPAGO_SANDBOX production
   # valor: true   (quitar al pasar a prod)

4) Probar
   node scripts/mp-onboard.mjs --check
   node scripts/mp-onboard.mjs --preference
   Luego: Venta rápida → condición Mercado Pago → pagar con usuario de prueba.
`)
}

async function mpFetch(path, token, init) {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body.message || body.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}

async function checkToken(token) {
  const me = await mpFetch('/users/me', token)
  console.log('OK token válido')
  console.log(`  user_id: ${me.id}`)
  console.log(`  nickname: ${me.nickname || '—'}`)
  console.log(`  email: ${me.email || '—'}`)
  console.log(`  site_id: ${me.site_id || '—'}`)
  return me
}

async function createTestPreference(token) {
  const base = webhookBase()
  const notification_url = `${base}/api/mp/webhook`
  const external_reference = `plotlab-smoke-${Date.now()}`
  const pref = await mpFetch('/checkout/preferences', token, {
    method: 'POST',
    body: JSON.stringify({
      items: [
        {
          title: 'Plot Lab — prueba MP',
          quantity: 1,
          unit_price: 10,
          currency_id: 'ARS'
        }
      ],
      external_reference,
      notification_url,
      statement_descriptor: 'PLOT LAB'
    })
  })
  console.log('OK preference creada')
  console.log(`  id: ${pref.id}`)
  console.log(`  init_point: ${pref.init_point}`)
  console.log(`  sandbox_init_point: ${pref.sandbox_init_point || '—'}`)
  console.log(`  external_reference: ${external_reference}`)
  console.log(`  notification_url: ${notification_url}`)
  return pref
}

async function ensureWebhooks(token) {
  const base = webhookBase()
  const urls = [`${base}/api/mp/webhook`, `${base}/api/totem/mp-webhook`]
  console.log('Webhooks objetivo (registrar en panel MP o vía API si tu plan lo permite):')
  for (const u of urls) console.log(`  - ${u}`)

  // Preferencias ya envían notification_url por cobro (api/_lib/mercadopago.ts).
  // Intento listar webhooks de aplicación si el endpoint está habilitado.
  try {
    const list = await mpFetch('/v1/webhooks', token)
    console.log('Webhooks actuales en la cuenta:', JSON.stringify(list).slice(0, 500))
  } catch (e) {
    console.log(
      `(Listado /v1/webhooks no disponible: ${e instanceof Error ? e.message : e}. Usá el panel → Webhooks.)`
    )
  }
}
  const url = `${webhookBase()}/api/mp/webhook`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'payment', action: 'payment.created', data: { id: '0' } })
    })
    console.log(`Webhook endpoint ${url} → HTTP ${res.status}`)
    const text = await res.text().catch(() => '')
    if (text) console.log(`  body: ${text.slice(0, 200)}`)
  } catch (e) {
    console.log(`Webhook ping falló: ${e instanceof Error ? e.message : e}`)
  }
}

const wantsCheck = process.argv.includes('--check')
const wantsPref = process.argv.includes('--preference')
const wantsPing = process.argv.includes('--ping-webhook')
const wantsHooks = process.argv.includes('--webhooks')

if (!wantsCheck && !wantsPref && !wantsPing && !wantsHooks) {
  printChecklist()
  process.exit(0)
}

const token = getToken()
if ((wantsCheck || wantsPref || wantsHooks) && token.length < 10) {
  console.error('Falta MERCADOPAGO_ACCESS_TOKEN (o --token). Obtenelo vía MCP OAuth get_credentials o panel MP.')
  printChecklist()
  process.exit(1)
}

try {
  if (wantsCheck) await checkToken(token)
  if (wantsHooks) await ensureWebhooks(token)
  if (wantsPref) await createTestPreference(token)
  if (wantsPing) await pingWebhook()
} catch (e) {
  console.error('Error:', e instanceof Error ? e.message : e)
  process.exit(1)
}
