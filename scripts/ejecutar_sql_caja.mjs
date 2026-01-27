#!/usr/bin/env node

/**
 * Script para ejecutar SQL en Supabase usando el cliente del proyecto
 * Ejecuta el script de verificación para Dashboard de Caja
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Obtener credenciales de Supabase desde variables de entorno o configuración
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bwdtrzcdzbzrtykjzber.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseServiceKey) {
  console.error('❌ Error: No se encontró SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY')
  console.error('   Configura la variable de entorno SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function executeSQL(sqlContent) {
  console.log('🚀 Ejecutando SQL en Supabase...\n')
  console.log('📋 URL:', supabaseUrl)
  console.log('')
  
  try {
    // Intentar ejecutar usando rpc si existe una función para ejecutar SQL
    // Nota: Esto normalmente no funciona para DDL, pero intentamos
    
    // Dividir el SQL en statements más pequeños si es necesario
    // Para DDL, necesitamos ejecutarlo completo
    
    console.log('⚠️  Nota: Supabase no permite ejecutar DDL desde el cliente JS.')
    console.log('')
    console.log('📝 El SQL debe ejecutarse desde el SQL Editor de Supabase.')
    console.log('')
    console.log('🔗 Ve a: https://app.supabase.com')
    console.log('   1. Selecciona tu proyecto')
    console.log('   2. Abre "SQL Editor"')
    console.log('   3. Copia y pega el SQL mostrado abajo')
    console.log('   4. Ejecuta (Run o Ctrl+Enter)')
    console.log('')
    console.log('═'.repeat(70))
    console.log('SQL A EJECUTAR:')
    console.log('═'.repeat(70))
    console.log(sqlContent)
    console.log('═'.repeat(70))
    console.log('')
    
    // Intentar verificar si las tablas ya existen usando el cliente
    console.log('🔍 Verificando estado actual de las tablas...\n')
    
    try {
      // Intentar consultar las tablas (esto solo funciona si tienen datos)
      const { data: cxcCheck, error: cxcError } = await supabase
        .from('cuentas_por_cobrar')
        .select('id')
        .limit(1)
      
      if (cxcError && cxcError.code === '42P01') {
        console.log('❌ Tabla cuentas_por_cobrar: NO EXISTE')
      } else if (cxcError) {
        console.log('⚠️  Tabla cuentas_por_cobrar: Error al verificar -', cxcError.message)
      } else {
        console.log('✅ Tabla cuentas_por_cobrar: EXISTE')
      }
    } catch (err) {
      console.log('❌ Tabla cuentas_por_cobrar: NO EXISTE (error:', err.message + ')')
    }
    
    try {
      const { data: cxpCheck, error: cxpError } = await supabase
        .from('cuentas_por_pagar')
        .select('id')
        .limit(1)
      
      if (cxpError && cxpError.code === '42P01') {
        console.log('❌ Tabla cuentas_por_pagar: NO EXISTE')
      } else if (cxpError) {
        console.log('⚠️  Tabla cuentas_por_pagar: Error al verificar -', cxpError.message)
      } else {
        console.log('✅ Tabla cuentas_por_pagar: EXISTE')
      }
    } catch (err) {
      console.log('❌ Tabla cuentas_por_pagar: NO EXISTE (error:', err.message + ')')
    }
    
    // Verificar función obtener_flujo_caja
    try {
      const { data: funcCheck, error: funcError } = await supabase
        .rpc('obtener_flujo_caja', {
          p_fecha_desde: '2025-01-01',
          p_fecha_hasta: '2025-01-31'
        })
      
      if (funcError && funcError.code === '42883') {
        console.log('❌ Función obtener_flujo_caja: NO EXISTE')
      } else if (funcError) {
        console.log('⚠️  Función obtener_flujo_caja: Error al verificar -', funcError.message)
      } else {
        console.log('✅ Función obtener_flujo_caja: EXISTE')
      }
    } catch (err) {
      console.log('❌ Función obtener_flujo_caja: NO EXISTE (error:', err.message + ')')
    }
    
    console.log('')
    console.log('✅ Verificación completada.')
    console.log('')
    console.log('📋 Para crear las tablas y funciones faltantes, ejecuta el SQL mostrado arriba en el SQL Editor.')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

async function main() {
  const sqlFile = path.join(__dirname, '..', 'supabase', 'patches', '2025-01-27_verificar_caja_dashboard.sql')
  
  try {
    const sqlContent = fs.readFileSync(sqlFile, 'utf-8')
    await executeSQL(sqlContent)
  } catch (error) {
    console.error('❌ Error leyendo el archivo SQL:', error.message)
    process.exit(1)
  }
}

main()

