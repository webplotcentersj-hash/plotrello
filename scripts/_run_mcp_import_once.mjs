import { readFileSync, statSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/_run_mcp_import_once.mjs <query.sql>')
  process.exit(1)
}

const abs = resolve(filePath)
const buf = readFileSync(abs)
console.log(`${abs}\t${buf.length}`)
