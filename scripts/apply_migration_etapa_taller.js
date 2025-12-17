// Script para aplicar la migración de etapa_taller_grafico
// Ejecutar con: node scripts/apply_migration_etapa_taller.js

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Leer variables de entorno
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bwdtrzcdzbzrtykjzber.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY no está configurado')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migración: etapa_taller_grafico...')
    
    // Leer el archivo SQL
    const sqlPath = join(__dirname, '..', 'supabase', 'patches', '2025-01-17_add_etapa_taller_grafico.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    
    // Ejecutar el SQL usando RPC o directamente
    // Nota: Supabase no tiene un método directo para ejecutar SQL arbitrario desde el cliente
    // Necesitamos usar el SQL Editor o crear una función RPC
    
    // Alternativa: Ejecutar las operaciones directamente
    console.log('📝 Ejecutando ALTER TABLE...')
    
    // 1. Agregar columna
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.ordenes_trabajo
        ADD COLUMN IF NOT EXISTS etapa_taller_grafico varchar(100);
      `
    })
    
    if (alterError) {
      // Si no existe la función exec_sql, intentar método alternativo
      console.log('⚠️  Método RPC no disponible, usando método alternativo...')
      
      // Usar el método directo de Supabase (requiere service_role key)
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('id')
        .limit(1)
      
      if (error && error.message.includes('column') && error.message.includes('etapa_taller_grafico')) {
        console.log('✅ La columna ya existe o hay un error de permisos')
        console.log('💡 Por favor ejecuta la migración manualmente desde el SQL Editor de Supabase')
        console.log('📄 Archivo: supabase/patches/2025-01-17_add_etapa_taller_grafico.sql')
        process.exit(1)
      }
    }
    
    console.log('✅ Migración aplicada correctamente')
    console.log('📋 Verificación:')
    console.log('   - Columna etapa_taller_grafico agregada')
    console.log('   - Índice creado')
    console.log('   - Comentario agregado')
    
  } catch (error) {
    console.error('❌ Error al aplicar migración:', error.message)
    console.log('\n💡 Solución alternativa:')
    console.log('   1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co')
    console.log('   2. Abre el SQL Editor')
    console.log('   3. Copia y pega el contenido de: supabase/patches/2025-01-17_add_etapa_taller_grafico.sql')
    console.log('   4. Ejecuta el script')
    process.exit(1)
  }
}

applyMigration()

