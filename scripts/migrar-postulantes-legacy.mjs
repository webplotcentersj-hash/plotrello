/**
 * Migra postulantes del dump PHP/MySQL + CVs locales a Supabase (rrhh_postulaciones + Storage).
 *
 * Origen:
 *   Postulantes/u956355532_postulaciones (2).sql
 *   Postulantes/uploads (1)/cv/*.pdf|doc|docx
 *
 * Requiere en .env: VITE_SUPABASE_URL y VITE_SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SERVICE_ROLE_KEY)
 *
 * Uso:
 *   node scripts/migrar-postulantes-legacy.mjs
 *   node scripts/migrar-postulantes-legacy.mjs --dry-run
 *   node scripts/migrar-postulantes-legacy.mjs --limit 10
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env') })

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitArg = args.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : 0

const SQL_PATH = join(root, 'Postulantes', 'u956355532_postulaciones (2).sql')
const CV_DIR = join(root, 'Postulantes', 'uploads (1)', 'cv')

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://bwdtrzcdzbzrtykjzber.supabase.co'
const supabaseKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

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
    while (i < tupleStr.length && /[0-9-]/.test(tupleStr[i])) {
      num += tupleStr[i++]
    }
    return num ? Number(num) : null
  }

  while (i < tupleStr.length && fields.length < 10) {
    fields.push(readField())
  }

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
  if (idx < 0) throw new Error('No se encontró INSERT INTO postulantes en el SQL')

  const valuesIdx = content.indexOf('VALUES', idx)
  const endIdx = content.indexOf('--\r\n-- Índices', valuesIdx)
  const endIdx2 = content.indexOf('--\n-- Índices', valuesIdx)
  const end = endIdx >= 0 ? endIdx : endIdx2 >= 0 ? endIdx2 : content.indexOf('ALTER TABLE `postulantes`', valuesIdx)

  const blob = content.slice(valuesIdx + 6, end).trim().replace(/;\s*$/, '')
  const tuples = splitTuples(blob)
  return tuples.map(parseTuple).filter((r) => r.id && r.nombre_completo && r.email)
}

async function main() {
  if (!existsSync(SQL_PATH)) {
    console.error('No existe:', SQL_PATH)
    process.exit(1)
  }
  if (!existsSync(CV_DIR)) {
    console.error('No existe carpeta CV:', CV_DIR)
    process.exit(1)
  }

  const sql = readFileSync(SQL_PATH, 'utf8')
  let records = parseSqlDump(sql)
  console.log(`Registros parseados del SQL: ${records.length}`)

  if (LIMIT > 0) {
    records = records.slice(0, LIMIT)
    console.log(`Modo limit: ${LIMIT} registros`)
  }

  const { data: existingRows, error: exErr } = await supabase
    .from('rrhh_postulaciones')
    .select('legacy_id')
    .not('legacy_id', 'is', null)

  if (exErr) {
    console.error('Error leyendo legacy_id existentes:', exErr.message)
    console.error('¿Aplicaste el patch 2026-06-09_rrhh_postulaciones_legacy_id.sql?')
    process.exit(1)
  }

  const existingIds = new Set((existingRows || []).map((r) => r.legacy_id))

  let imported = 0
  let skipped = 0
  let missingCv = 0
  let errors = 0

  for (const rec of records) {
    if (existingIds.has(rec.id)) {
      skipped++
      continue
    }

    const cvFilename = basename(String(rec.cv_ruta || '').replace(/\\/g, '/'))
    const localCv = join(CV_DIR, cvFilename)

    if (!cvFilename || !existsSync(localCv)) {
      missingCv++
      console.warn(`[${rec.id}] CV no encontrado: ${cvFilename}`)
      continue
    }

    const mime = mimeFromName(cvFilename)
    const storagePath = `cv-postulaciones/legacy_${rec.id}_${cvFilename}`

    if (DRY_RUN) {
      console.log(`[dry-run] ${rec.id} ${rec.nombre_completo} → ${storagePath}`)
      imported++
      continue
    }

    try {
      const fileBuf = readFileSync(localCv)
      const { error: upErr } = await supabase.storage.from('archivos').upload(storagePath, fileBuf, {
        upsert: true,
        contentType: mime,
        cacheControl: '31536000'
      })
      if (upErr) throw new Error(`upload: ${upErr.message}`)

      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(storagePath)
      const cvUrl = urlData?.publicUrl
      if (!cvUrl) throw new Error('URL pública vacía')

      const fecha = rec.fecha_postulacion
        ? String(rec.fecha_postulacion).replace(' ', 'T') + (String(rec.fecha_postulacion).includes('T') ? '' : 'Z')
        : new Date().toISOString()

      const row = {
        legacy_id: rec.id,
        nombre: String(rec.nombre_completo).trim(),
        email: String(rec.email).trim().toLowerCase(),
        telefono: rec.telefono ? String(rec.telefono).trim() : null,
        puesto: (rec.puesto_deseado && String(rec.puesto_deseado).trim()) || 'Otro',
        categoria_puesto: null,
        mensaje: rec.mensaje ? String(rec.mensaje).trim() : null,
        cv_url: cvUrl,
        cv_nombre: cvFilename,
        cv_mime: mime,
        estado: mapEstado(rec.status),
        notas_rrhh: rec.notas_rrhh ? String(rec.notas_rrhh).trim() : null,
        metadata_ia: {
          imported_from: 'php_postulaciones',
          legacy_status: rec.status,
          legacy_cv_ruta: rec.cv_ruta,
          migrated_at: new Date().toISOString()
        },
        created_at: fecha,
        updated_at: fecha
      }

      const { error: insErr } = await supabase.from('rrhh_postulaciones').insert(row)
      if (insErr) throw new Error(`insert: ${insErr.message}`)

      imported++
      if (imported % 25 === 0) console.log(`… ${imported} importados`)
    } catch (e) {
      errors++
      console.error(`[${rec.id}] ${rec.nombre_completo}:`, e.message || e)
    }
  }

  console.log('\n--- Resumen migración ---')
  console.log(`Importados: ${imported}${DRY_RUN ? ' (dry-run)' : ''}`)
  console.log(`Omitidos (ya existían): ${skipped}`)
  console.log(`Sin CV local: ${missingCv}`)
  console.log(`Errores: ${errors}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
