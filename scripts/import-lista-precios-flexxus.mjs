/**
 * Genera supabase/patches/2026-06-18_import_lista_precios_flexxus.sql
 * desde lISTA/Lista_Precios_Flexxus (1).xlsx
 *
 * Columnas Excel: Código, Descripción, Rubro, Lista 1..5
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const xlsxPath = path.join(root, 'lISTA', 'Lista_Precios_Flexxus (1).xlsx')
const outPath = path.join(root, 'supabase', 'patches', '2026-06-18_import_lista_precios_flexxus.sql')

function sqlStr(s) {
  if (s == null || s === '') return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

function sqlNum(n) {
  if (n == null || n === '' || Number(n) === 0) return 'NULL'
  const v = Number(n)
  if (!Number.isFinite(v)) return 'NULL'
  return v.toFixed(2)
}

const wb = XLSX.readFile(xlsxPath)
const sheet = wb.Sheets['Lista de Precios']
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
const rows = matrix.slice(1).filter((r) => String(r[0] || '').trim())

const values = rows.map((r) => {
  const codigo = String(r[0]).trim()
  const nombre = String(r[1] || codigo).trim()
  const categoria = String(r[2] || '').trim() || null
  const l1 = r[3]
  const l2 = r[4]
  const l3 = r[5]
  const l4 = r[6]
  const l5 = r[7]
  const precioBase = l1 != null && l1 !== '' ? Number(l1) : null
  return `(
  ${sqlStr(codigo)},
  ${sqlStr(nombre)},
  ${categoria ? sqlStr(categoria) : 'NULL'},
  ${sqlNum(l1)},
  ${sqlNum(l2)},
  ${sqlNum(l3)},
  ${sqlNum(l4)},
  ${sqlNum(l5)},
  ${precioBase != null && Number.isFinite(precioBase) ? precioBase.toFixed(2) : 'NULL'}
)`
})

const header = `-- Import Lista de Precios Flexxus (${rows.length} artículos)
-- Fuente: lISTA/Lista_Precios_Flexxus (1).xlsx · hoja "Lista de Precios"
-- Lista 1 = efectivo/débito · Lista 2 = cuenta corriente · Listas 3-5 según Flexxus

BEGIN;

-- Asegurar columnas (idempotente si ya corrió 2026-06-16 / 2026-06-18_schema)
ALTER TABLE public.articulos_empresa
  ADD COLUMN IF NOT EXISTS precio_lista_1 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_2 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_3 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_4 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_5 numeric(12, 2);

CREATE TEMP TABLE _import_lista_flexxus (
  codigo varchar(100) NOT NULL,
  nombre varchar(255) NOT NULL,
  categoria varchar(255),
  precio_lista_1 numeric(12, 2),
  precio_lista_2 numeric(12, 2),
  precio_lista_3 numeric(12, 2),
  precio_lista_4 numeric(12, 2),
  precio_lista_5 numeric(12, 2),
  precio_base numeric(12, 2)
) ON COMMIT DROP;

INSERT INTO _import_lista_flexxus (
  codigo, nombre, categoria,
  precio_lista_1, precio_lista_2, precio_lista_3, precio_lista_4, precio_lista_5,
  precio_base
) VALUES
${values.join(',\n')};

-- Actualizar existentes por código
UPDATE public.articulos_empresa ae
SET
  nombre = i.nombre,
  categoria = COALESCE(i.categoria, ae.categoria),
  precio_lista_1 = i.precio_lista_1,
  precio_lista_2 = i.precio_lista_2,
  precio_lista_3 = i.precio_lista_3,
  precio_lista_4 = i.precio_lista_4,
  precio_lista_5 = i.precio_lista_5,
  precio_base = COALESCE(i.precio_base, ae.precio_base),
  activo = true,
  updated_at = now()
FROM _import_lista_flexxus i
WHERE ae.codigo = i.codigo;

-- Alta de códigos nuevos
INSERT INTO public.articulos_empresa (
  codigo,
  nombre,
  categoria,
  precio_lista_1,
  precio_lista_2,
  precio_lista_3,
  precio_lista_4,
  precio_lista_5,
  precio_base,
  activo,
  visible_clientes,
  requiere_archivos
)
SELECT
  i.codigo,
  i.nombre,
  i.categoria,
  i.precio_lista_1,
  i.precio_lista_2,
  i.precio_lista_3,
  i.precio_lista_4,
  i.precio_lista_5,
  i.precio_base,
  true,
  false,
  false
FROM _import_lista_flexxus i
WHERE NOT EXISTS (
  SELECT 1 FROM public.articulos_empresa ae WHERE ae.codigo = i.codigo
);

COMMIT;
`

fs.writeFileSync(outPath, header, 'utf8')
console.log(`Wrote ${outPath} (${rows.length} rows, ${(header.length / 1024).toFixed(1)} KB)`)
