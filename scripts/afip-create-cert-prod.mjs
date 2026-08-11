/**
 * Genera certificado + clave de producción ARCA vía Afip SDK (create-cert-prod).
 * Docs: https://afipsdk.com/docs/automations/create-cert-prod/?integration=nodejs
 *
 * Uso (desde la raíz del repo):
 *   node --env-file=.env.local scripts/afip-create-cert-prod.mjs
 *
 * Env requeridos:
 *   AFIP_ACCESS_TOKEN   → https://app.afipsdk.com
 *   AFIP_CUIT           → CUIT del contribuyente (ej. 30712345678)
 *   AFIP_ARCA_PASSWORD  → contraseña de ARCA (no la guardes en git)
 *
 * Env opcionales:
 *   AFIP_ARCA_USERNAME  → CUIT de login (default = AFIP_CUIT; sociedad: CUIT del administrador)
 *   AFIP_CERT_ALIAS     → alias alfanumérico (default: plotlab)
 *   AFIP_CERT_OUT_DIR   → carpeta de salida (default: .afip-certs, gitignored)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Afip from '@afipsdk/afip.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function requireEnv(name) {
  const v = (process.env[name] || '').trim()
  if (!v) {
    console.error(`Falta ${name} en el entorno (.env.local).`)
    process.exit(1)
  }
  return v
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

async function main() {
  const accessToken = requireEnv('AFIP_ACCESS_TOKEN')
  const cuit = digitsOnly(requireEnv('AFIP_CUIT'))
  const password = requireEnv('AFIP_ARCA_PASSWORD')
  const username = digitsOnly(process.env.AFIP_ARCA_USERNAME || cuit)
  const alias = (process.env.AFIP_CERT_ALIAS || 'plotlab').trim().replace(/[^a-zA-Z0-9]/g, '') || 'plotlab'
  const outDir = path.resolve(root, process.env.AFIP_CERT_OUT_DIR || '.afip-certs')

  if (cuit.length !== 11) {
    console.error('AFIP_CUIT debe tener 11 dígitos.')
    process.exit(1)
  }

  const afip = new Afip({ access_token: accessToken })

  const data = {
    cuit,
    username,
    password,
    alias
  }

  console.log(`Ejecutando create-cert-prod (cuit=${cuit}, alias=${alias})…`)
  const response = await afip.CreateAutomation('create-cert-prod', data, true)

  if (!response || response.status !== 'complete' || !response.data?.cert || !response.data?.key) {
    console.error('Respuesta inesperada de Afip SDK:')
    console.error(JSON.stringify(response, null, 2))
    process.exit(1)
  }

  await mkdir(outDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const certPath = path.join(outDir, `${alias}-prod-${stamp}.crt`)
  const keyPath = path.join(outDir, `${alias}-prod-${stamp}.key`)

  await writeFile(certPath, response.data.cert, 'utf8')
  await writeFile(keyPath, response.data.key, 'utf8')

  console.log('OK. Certificado y clave guardados (no los subas a git):')
  console.log(`  ${certPath}`)
  console.log(`  ${keyPath}`)
  console.log('')
  console.log('Para producción en Vercel / .env.local:')
  console.log('  AFIP_PRODUCTION=true')
  console.log('  AFIP_CUIT=' + cuit)
  console.log('  AFIP_CERT="<contenido PEM del .crt, con \\n en saltos de línea>"')
  console.log('  AFIP_KEY="<contenido PEM del .key, con \\n en saltos de línea>"')
  console.log('')
  console.log(`Automation id: ${response.id}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
