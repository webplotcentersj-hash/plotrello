/**
 * Genera capturas PNG para docs/IMPLEMENTACION_BITACORA_OPERARIOS.html
 *
 * Uso:
 *   npm run dev   (otra terminal)
 *   npm run docs:bitacora-capturas
 *
 * Producción (requiere credenciales):
 *   set DOC_STAFF_USER=achavez@plotcenter.com.ar
 *   set DOC_STAFF_PASS=...
 *   set BASE_URL=https://www.plotcenterlab.com.ar
 *   node scripts/capture-bitacora-screenshots.mjs --live
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'docs', 'img', 'bitacora-operarios')
const LIVE = process.argv.includes('--live')
const BASE = process.env.BASE_URL || (LIVE ? 'https://www.plotcenterlab.com.ar' : 'http://localhost:5173')

const ADMIN_SEED = {
  plotlab_session_kind: 'staff',
  usuario: JSON.stringify({
    id: 6,
    nombre: 'achavez@plotcenter.com.ar',
    rol: 'administracion',
    nombreVisible: 'Alejandro Chávez'
  }),
  usuario_id: '6'
}

const CAPTURE_SCENES = [
  { file: '01-fab-boton.png', scene: '01', selector: '[data-scene="01"]', live: null },
  { file: '02-fab-tabs.png', scene: '02', selector: '[data-scene="02"]', live: null },
  { file: '03-fab-composer.png', scene: '03', selector: '[data-scene="03"]', live: null },
  { file: '04-fab-lista-hoy.png', scene: '04', selector: '[data-scene="04"]', live: null },
  { file: '05-admin-acceso-header.png', scene: '05', selector: '[data-scene="05"]', live: 'header' },
  { file: '06-admin-plot-design-btn.png', scene: '06', selector: '[data-scene="06"]', live: 'plot-design' },
  { file: '07-supervision-calendario.png', scene: '07', selector: '[data-scene="07"]', live: 'actividades' },
  { file: '08-supervision-dia.png', scene: '08', selector: '[data-scene="08"]', live: 'actividades-dia' },
  { file: '09-supervision-modal.png', scene: '09', selector: '[data-scene="09"]', live: 'actividades-modal' },
  { file: '10-legajo-tab.png', scene: '10', selector: '[data-scene="10"]', live: 'legajo' }
]

async function seedAdmin(page) {
  await page.addInitScript((seed) => {
    for (const [k, v] of Object.entries(seed)) {
      localStorage.setItem(k, v)
    }
  }, ADMIN_SEED)
}

async function loginStaff(page) {
  const user = process.env.DOC_STAFF_USER
  const pass = process.env.DOC_STAFF_PASS
  if (!user || !pass) return false

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.fill('#usuario', user)
  await page.fill('#password', pass)
  await page.click('button.login-button')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })
  return true
}

async function captureDev(page, { scene, selector, file }) {
  const needsAdmin = ['05', '06', '07', '08', '09', '10'].includes(scene)
  if (needsAdmin) await seedAdmin(page)

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${BASE}/__docs/bitacora-capturas?scene=${scene}`, {
    waitUntil: 'networkidle',
    timeout: 60000
  })
  await page.waitForSelector(selector, { timeout: 15000 })
  await page.waitForTimeout(400)

  const el = page.locator(selector)
  await el.screenshot({ path: path.join(OUT_DIR, file) })
  console.log('✓', file)
}

async function captureLive(page, spec) {
  const { file, live } = spec
  await page.setViewportSize({ width: 1280, height: 900 })

  if (live === 'header') {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('.header-user-chip--link', { timeout: 20000 })
    const header = page.locator('.app-header, header.header, .header-container').first()
    await header.screenshot({ path: path.join(OUT_DIR, file) })
  } else if (live === 'plot-design') {
    await page.goto(`${BASE}/plot-design`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('.work-pool-admin__hero-actions', { timeout: 20000 })
    const hero = page.locator('.work-pool-admin__hero').first()
    await hero.screenshot({ path: path.join(OUT_DIR, file) })
  } else if (live === 'actividades') {
    await page.goto(`${BASE}/actividades-operarios`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('.act-op-cal', { timeout: 20000 })
    const layout = page.locator('.act-op-page__layout').first()
    await layout.screenshot({ path: path.join(OUT_DIR, file) })
  } else if (live === 'actividades-dia') {
    await page.goto(`${BASE}/actividades-operarios`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('.act-op-card', { timeout: 20000 }).catch(() => null)
    const main = page.locator('.act-op-page__main').first()
    await main.screenshot({ path: path.join(OUT_DIR, file) })
  } else if (live === 'actividades-modal') {
    await page.goto(`${BASE}/actividades-operarios`, { waitUntil: 'networkidle', timeout: 60000 })
    const item = page.locator('.act-op-card__item-btn').first()
    if (await item.count()) {
      await item.click()
      await page.waitForSelector('.act-op-detalle', { timeout: 10000 })
      await page.locator('.act-op-detalle').screenshot({ path: path.join(OUT_DIR, file) })
    } else {
      throw new Error('No hay entradas para abrir el modal en producción')
    }
  } else if (live === 'legajo') {
    await page.goto(`${BASE}/actividades-operarios`, { waitUntil: 'networkidle', timeout: 60000 })
    const legajoBtn = page.locator('.act-op-card__legajo-btn').first()
    if (await legajoBtn.count()) {
      await legajoBtn.click()
      await page.waitForSelector('.ver-legajo-tab.active', { timeout: 15000 })
      const tab = page.locator('button.ver-legajo-tab', { hasText: 'Actividades Plot' })
      if (await tab.count()) await tab.click()
      await page.waitForSelector('.legajo-act-plot, .legajo-act-plot--muted', { timeout: 15000 })
      await page.locator('.ver-legajo-modal-content').screenshot({ path: path.join(OUT_DIR, file) })
    } else {
      throw new Error('No hay legajo para capturar en producción')
    }
  } else {
    return captureDev(page, spec)
  }
  console.log('✓', file, '(live)')
}

async function waitForDevServer() {
  const max = 30
  for (let i = 0; i < max; i += 1) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) })
      if (res.ok || res.status === 404) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Dev server no responde en ${BASE}. Ejecutá npm run dev primero.`)
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true })

  if (!LIVE) await waitForDevServer()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  let useLive = LIVE
  if (LIVE) {
    const ok = await loginStaff(page)
    if (!ok) {
      console.warn('Sin DOC_STAFF_USER/PASS — usando escenas dev locales')
      useLive = false
    }
  }

  for (const spec of CAPTURE_SCENES) {
    try {
      if (useLive && spec.live) {
        await captureLive(page, spec)
      } else {
        await captureDev(page, spec)
      }
    } catch (err) {
      console.error('✗', spec.file, err instanceof Error ? err.message : err)
      process.exitCode = 1
    }
  }

  await browser.close()
  console.log('\nCapturas en', OUT_DIR)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
