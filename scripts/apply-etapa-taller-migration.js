// Script para aplicar la migración de etapa_taller_grafico usando Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = 'https://bwdtrzcdzbzrtykjzber.supabase.co'
// Necesitas usar SERVICE_ROLE_KEY para ejecutar DDL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_SERVICE_ROLE_KEY no está configurado')
  console.log('💡 Necesitas configurar VITE_SUPABASE_SERVICE_ROLE_KEY en tu .env')
  console.log('   Obtén la SERVICE_ROLE_KEY desde: https://app.supabase.com/project/bwdtrzcdzbzrtykjzber/settings/api')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('🔄 Aplicando migración: etapa_taller_grafico...\n')
  
  try {
    // Ejecutar cada comando SQL por separado usando RPC
    // Primero intentar crear una función RPC temporal si no existe
    
    const sqlCommands = [
      `ALTER TABLE public.ordenes_trabajo ADD COLUMN IF NOT EXISTS etapa_taller_grafico varchar(100);`,
      `CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_etapa_taller_grafico ON public.ordenes_trabajo(etapa_taller_grafico);`,
      `COMMENT ON COLUMN public.ordenes_trabajo.etapa_taller_grafico IS 'Etapa actual dentro de Taller Gráfico: Falta Material para Impresión o archivo, En Proceso, Para Cortar o Pegar, Para Rotular, Instalaciones/Ploteo, Metalurgica Instalacion, laminas';`
    ]
    
    // Nota: Supabase JS client no puede ejecutar DDL directamente
    // Necesitamos usar el SQL Editor o crear una función RPC
    
    console.log('⚠️  El cliente de Supabase JS no puede ejecutar DDL directamente.')
    console.log('📋 Por favor ejecuta la migración manualmente:\n')
    console.log('1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co')
    console.log('2. Abre el SQL Editor')
    console.log('3. Copia y pega este SQL:\n')
    console.log('─'.repeat(60))
    
    const sqlPath = join(__dirname, '..', 'supabase', 'patches', '2025-01-17_add_etapa_taller_grafico.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(sql)
    console.log('─'.repeat(60))
    
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

applyMigration()

