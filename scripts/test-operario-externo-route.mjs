import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173'

async function seedOperario(page, withToken = false) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((token) => {
    localStorage.setItem(
      'usuario',
      JSON.stringify({ id: 99999, nombre: 'test-externo', rol: 'operario-bolsa' })
    )
    localStorage.setItem('usuario_id', '99999')
    if (token) localStorage.setItem('auth_token', token)
    else localStorage.removeItem('auth_token')
  }, withToken ? 'invalid-jwt' : '')
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await seedOperario(page, false)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  console.log('sin JWT, / →', page.url(), '| panel:', (await page.textContent('body'))?.includes('Panel operario externo'))

  await seedOperario(page, true)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  console.log('JWT inválido, / →', page.url(), '| panel:', (await page.textContent('body'))?.includes('Panel operario externo'))

  await seedOperario(page, false)
  await page.goto(`${BASE}/operario-externo/bolsa`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.wp-operario-dash', { timeout: 15000 }).catch(() => null)
  const body = await page.textContent('body')
  console.log('panel directo →', page.url(), '| panel:', body?.includes('Panel operario externo'))

  await browser.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
