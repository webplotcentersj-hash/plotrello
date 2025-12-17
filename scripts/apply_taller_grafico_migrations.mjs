/**
 * Script para aplicar las migraciones de Taller Gráfico
 * Ejecuta los 3 archivos SQL en orden usando el API REST de Supabase
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Obtener credenciales desde variables de entorno
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwdtrzcdzbzrtykjzber.supabase.co'
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ Error: Falta VITE_SUPABASE_SERVICE_ROLE_KEY')
  console.error('Necesitas configurar la SERVICE_ROLE_KEY para ejecutar DDL')
  console.error('\n📋 Alternativa: Ejecuta las migraciones manualmente desde el SQL Editor de Supabase')
  console.error('1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co')
  console.error('2. Abre el SQL Editor')
  console.error('3. Ejecuta los archivos en orden:\n')
  
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
  
  process.exit(1)
}

async function executeSQL(sql) {
  // Usar el API REST de Supabase para ejecutar SQL
  // Esto requiere usar el endpoint de PostgREST con service_role key
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ sql })
  })
  
  if (!response.ok) {
    // Si no existe la función exec_sql, intentar método alternativo
    // Usar el endpoint directo de Supabase Management API si está disponible
    console.log('⚠️  Método RPC no disponible, intentando método alternativo...')
    
    // Nota: Supabase no expone un endpoint público para ejecutar SQL arbitrario
    // Las migraciones deben ejecutarse desde el SQL Editor
    throw new Error('No se puede ejecutar DDL desde el cliente. Usa el SQL Editor.')
  }
  
  return await response.json()
}

async function applyMigrations() {
  console.log('🔄 Aplicando migraciones de Taller Gráfico...\n')
  
  const migrations = [
    'supabase/patches/2025-01-17_add_etapa_taller_grafico.sql',
    'supabase/patches/2025-01-17_add_historial_etapas_taller_grafico.sql',
    'supabase/patches/2025-01-17_add_notificaciones_cambio_etapa.sql'
  ]
  
  for (let i = 0; i < migrations.length; i++) {
    const file = migrations[i]
    console.log(`\n📄 Ejecutando migración ${i + 1}/${migrations.length}: ${file}`)
    
    try {
      const sqlPath = join(__dirname, '..', file)
      const sql = readFileSync(sqlPath, 'utf-8')
      
      // Intentar ejecutar
      await executeSQL(sql)
      console.log(`✅ Migración ${i + 1} aplicada correctamente`)
    } catch (error) {
      console.error(`❌ Error en migración ${i + 1}:`, error.message)
      console.log('\n📋 Por favor ejecuta esta migración manualmente desde el SQL Editor:')
      console.log('─'.repeat(70))
      const sqlPath = join(__dirname, '..', file)
      const sql = readFileSync(sqlPath, 'utf-8')
      console.log(sql)
      console.log('─'.repeat(70))
      
      if (i < migrations.length - 1) {
        console.log('\n⚠️  Continuando con las siguientes migraciones...')
      }
    }
  }
  
  console.log('\n✅ Proceso completado')
  console.log('💡 Si alguna migración falló, ejecútala manualmente desde el SQL Editor de Supabase')
}

applyMigrations().catch(error => {
  console.error('❌ Error fatal:', error.message)
  process.exit(1)
})

