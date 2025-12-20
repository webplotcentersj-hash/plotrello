/**
 * Script para aplicar el fix de usuario_sectores directamente en Supabase
 * Ejecutar con: node scripts/apply_fix_usuario_sectores.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Obtener variables de entorno
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no configuradas')
  console.error('   Necesitas configurar:')
  console.error('   - VITE_SUPABASE_URL o SUPABASE_URL')
  console.error('   - VITE_SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY (recomendado)')
  console.error('   - O VITE_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY (alternativa)')
  process.exit(1)
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey)

// Leer el archivo SQL
const sqlFile = join(__dirname, '..', 'EJECUTAR_FIX_USUARIO_SECTORES.sql')
let sqlContent

try {
  sqlContent = readFileSync(sqlFile, 'utf-8')
  console.log('✅ Archivo SQL leído correctamente')
} catch (error) {
  console.error('❌ Error leyendo archivo SQL:', error.message)
  process.exit(1)
}

// Ejecutar el SQL
async function applyFix() {
  console.log('🔄 Aplicando fix de usuario_sectores...')
  console.log('📋 URL de Supabase:', supabaseUrl)
  console.log('')
  
  try {
    // Dividir el SQL en statements (separados por ;)
    // Nota: Esto es una simplificación. Para SQL complejo con funciones, 
    // es mejor ejecutarlo todo junto si Supabase lo permite
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📊 Encontrados ${statements.length} statements SQL`)
    console.log('')
    
    // Ejecutar todo el SQL de una vez usando rpc o directamente
    // Nota: Supabase no tiene un método directo para ejecutar SQL arbitrario desde el cliente JS
    // Necesitamos usar el SQL Editor de Supabase o la API REST
    
    console.log('⚠️  Nota: El cliente JS de Supabase no puede ejecutar SQL arbitrario directamente.')
    console.log('')
    console.log('📝 Por favor, ejecuta el siguiente script en el SQL Editor de Supabase:')
    console.log('   1. Ve a tu proyecto en Supabase Dashboard')
    console.log('   2. Abre "SQL Editor"')
    console.log('   3. Copia y pega el contenido de: EJECUTAR_FIX_USUARIO_SECTORES.sql')
    console.log('   4. Haz clic en "Run"')
    console.log('')
    console.log('📄 O ejecuta manualmente el archivo: EJECUTAR_FIX_USUARIO_SECTORES.sql')
    console.log('')
    
    // Alternativa: Intentar usar la API REST de Supabase si está disponible
    // Esto requiere SERVICE_ROLE_KEY
    if (supabaseKey.includes('service_role') || process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('🔧 Intentando ejecutar usando API REST...')
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ sql: sqlContent })
        })
        
        if (response.ok) {
          console.log('✅ SQL ejecutado correctamente')
          return
        } else {
          const error = await response.text()
          console.log('⚠️  No se pudo ejecutar via API REST:', error)
        }
      } catch (error) {
        console.log('⚠️  Error al intentar ejecutar via API REST:', error.message)
      }
    }
    
    console.log('')
    console.log('💡 Recomendación: Ejecuta el SQL manualmente en Supabase SQL Editor')
    
  } catch (error) {
    console.error('❌ Error aplicando fix:', error.message)
    console.error('')
    console.error('💡 Por favor, ejecuta el SQL manualmente en Supabase SQL Editor:')
    console.error('   - Archivo: EJECUTAR_FIX_USUARIO_SECTORES.sql')
    process.exit(1)
  }
}

applyFix()

