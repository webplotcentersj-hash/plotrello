import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem(
      'usuario',
      JSON.stringify({ id: 1, nombre: 'ext', rol: 'operario-bolsa' })
    )
    localStorage.setItem('usuario_id', '1')
    localStorage.setItem('auth_token', 'invalid-jwt-token')
  })

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  const url1 = page.url()
  const body1 = await page.textContent('body')
  console.log('JWT inválido, visita / →', url1)
  console.log('  login:', body1?.includes('Inicia sesión'))
  console.log('  panel:', body1?.includes('Panel operario externo'))
  console.log('  tablero:', body1?.includes('kanban') || body1?.includes('Tablero'))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.setItem(
      'usuario',
      JSON.stringify({ id: 1, nombre: 'ext', rol: 'operario-bolsa' })
    )
    localStorage.setItem('usuario_id', '1')
    localStorage.setItem('auth_token', 'invalid-jwt-token')
  })

  await page.goto(`${BASE}/operario-externo/bolsa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  const url2 = page.url()
  const body2 = await page.textContent('body')
  console.log('JWT inválido, panel directo →', url2)
  console.log('  login:', body2?.includes('Inicia sesión'))
  console.log('  panel:', body2?.includes('Panel operario externo'))

  await browser.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
