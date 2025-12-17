/**
 * Script para aplicar las migraciones de Taller Gráfico
 * Ejecuta los 3 archivos SQL en orden
 */

const { createClient } = require('@supabase/supabase-js')
const { readFileSync } = require('fs')
const { join } = require('path')

// Obtener credenciales desde variables de entorno
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan variables de entorno')
  console.error('Necesitas configurar:')
  console.error('  - VITE_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - VITE_SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function executeSQL(sql) {
  // Supabase JS client no puede ejecutar DDL directamente
  // Necesitamos usar el REST API directamente o el SQL Editor
  console.log('⚠️  El cliente de Supabase JS no puede ejecutar DDL directamente.')
  console.log('📋 Por favor ejecuta las migraciones manualmente desde el SQL Editor de Supabase:\n')
  console.log('1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co')
  console.log('2. Abre el SQL Editor')
  console.log('3. Ejecuta los siguientes archivos en orden:\n')
  
  const migrations = [
    'supabase/patches/2025-01-17_add_etapa_taller_grafico.sql',
    'supabase/patches/2025-01-17_add_historial_etapas_taller_grafico.sql',
    'supabase/patches/2025-01-17_add_notificaciones_cambio_etapa.sql'
  ]
  
  migrations.forEach((file, index) => {
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`📄 Migración ${index + 1}: ${file}`)
    console.log('─'.repeat(70))
    const sqlPath = join(__dirname, '..', file)
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(sql)
  })
  
  console.log('\n' + '─'.repeat(70))
  console.log('✅ Después de ejecutar todas las migraciones, el sistema debería funcionar correctamente.')
}

async function applyMigrations() {
  console.log('🔄 Aplicando migraciones de Taller Gráfico...\n')
  
  try {
    await executeSQL()
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

applyMigrations()

