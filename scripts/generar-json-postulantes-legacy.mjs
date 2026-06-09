/**
 * Genera lotes JSON para importar vía rrhh_importar_postulaciones_legacy (MCP).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const SQL_PATH = join(root, 'Postulantes', 'u956355532_postulaciones (2).sql')
const CV_DIR = join(root, 'Postulantes', 'uploads (1)', 'cv')
const OUT_DIR = join(root, 'Postulantes', '_json_batches')
const PROJECT_URL = 'https://bwdtrzcdzbzrtykjzber.supabase.co'
const BATCH = 25

function mapEstado(status) {
  const s = String(status || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (s.includes('rechaz')) return 'descartado'
  if (s.includes('revision')) return 'en_revision'
  if (s.includes('entrevista')) return 'entrevista'
  if (s.includes('aprob')) return 'aprobado'
  return 'nuevo'
}

function mimeFromName(name) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  return 'application/octet-stream'
}

// parser (same as migrar-postulantes-legacy.mjs)
function splitTuples(blob) {
  const tuples = []
  let depth = 0
  let inString = false
  let start = -1
  for (let i = 0; i < blob.length; i++) {
    const c = blob[i]
    if (inString) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === "'" && blob[i + 1] === "'") {
        i++
        continue
      }
      if (c === "'") inString = false
      continue
    }
    if (c === "'") {
      inString = true
      continue
    }
    if (c === '(') {
      if (depth === 0) start = i
      depth++
    } else if (c === ')') {
      depth--
      if (depth === 0 && start >= 0) {
        tuples.push(blob.slice(start, i + 1))
        start = -1
      }
    }
  }
  return tuples
}

function parseTuple(tupleStr) {
  const fields = []
  let i = 1
  const readField = () => {
    while (i < tupleStr.length && (tupleStr[i] === ' ' || tupleStr[i] === ',')) i++
    if (tupleStr.slice(i, i + 4) === 'NULL') {
      i += 4
      return null
    }
    if (tupleStr[i] === "'") {
      i++
      let s = ''
      while (i < tupleStr.length) {
        const c = tupleStr[i]
        if (c === '\\' && i + 1 < tupleStr.length) {
          const next = tupleStr[i + 1]
          if (next === 'r') {
            s += '\r'
            i += 2
            continue
          }
          if (next === 'n') {
            s += '\n'
            i += 2
            continue
          }
          s += next
          i += 2
          continue
        }
        if (c === "'" && tupleStr[i + 1] === "'") {
          s += "'"
          i += 2
          continue
        }
        if (c === "'") {
          i++
          break
        }
        s += c
        i++
      }
      return s
    }
    let num = ''
    while (i < tupleStr.length && /[0-9-]/.test(tupleStr[i])) num += tupleStr[i++]
    return num ? Number(num) : null
  }
  while (i < tupleStr.length && fields.length < 10) fields.push(readField())
  return {
    id: fields[0],
    nombre_completo: fields[1],
    email: fields[2],
    telefono: fields[3],
    puesto_deseado: fields[4],
    mensaje: fields[5],
    cv_ruta: fields[6],
    status: fields[7],
    notas_rrhh: fields[8],
    fecha_postulacion: fields[9]
  }
}

function parseSqlDump(content) {
  const marker = 'INSERT INTO `postulantes`'
  const idx = content.indexOf(marker)
  const valuesIdx = content.indexOf('VALUES', idx)
  const endIdx = content.indexOf('--\r\n-- Índices', valuesIdx)
  const endIdx2 = content.indexOf('--\n-- Índices', valuesIdx)
  const end = endIdx >= 0 ? endIdx : endIdx2 >= 0 ? endIdx2 : content.indexOf('ALTER TABLE `postulantes`', valuesIdx)
  const blob = content.slice(valuesIdx + 6, end).trim().replace(/;\s*$/, '')
  return splitTuples(blob).map(parseTuple).filter((r) => r.id && r.nombre_completo && r.email)
}

const sql = readFileSync(SQL_PATH, 'utf8')
const records = parseSqlDump(sql)
const rows = []

for (const rec of records) {
  const cvFilename = basename(String(rec.cv_ruta || '').replace(/\\/g, '/'))
  const storagePath = `cv-postulaciones/legacy_${rec.id}_${cvFilename}`
  const cvUrl = `${PROJECT_URL}/storage/v1/object/public/archivos/${storagePath}`
  const fecha = rec.fecha_postulacion
    ? String(rec.fecha_postulacion).replace(' ', 'T') + '+00:00'
    : new Date().toISOString()

  rows.push({
    legacy_id: rec.id,
    nombre: String(rec.nombre_completo).trim(),
    email: String(rec.email).trim().toLowerCase(),
    telefono: rec.telefono ? String(rec.telefono).trim() : '',
    puesto: (rec.puesto_deseado && String(rec.puesto_deseado).trim()) || 'Otro',
    categoria_puesto: '',
    mensaje: rec.mensaje ? String(rec.mensaje).trim() : '',
    cv_url: cvUrl,
    cv_nombre: cvFilename,
    cv_mime: mimeFromName(cvFilename),
    estado: mapEstado(rec.status),
    notas_rrhh: rec.notas_rrhh ? String(rec.notas_rrhh).trim() : '',
    metadata_ia: {
      imported_from: 'php_postulaciones',
      legacy_status: rec.status,
      legacy_cv_ruta: rec.cv_ruta,
      migrated_at: new Date().toISOString()
    },
    created_at: fecha,
    updated_at: fecha
  })
}

mkdirSync(OUT_DIR, { recursive: true })
let batchIdx = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH)
  writeFileSync(join(OUT_DIR, `batch_${String(batchIdx).padStart(3, '0')}.json`), JSON.stringify(chunk))
  batchIdx++
}

console.error(`JSON batches: ${batchIdx} (${rows.length} registros, CV dir: ${CV_DIR})`)
