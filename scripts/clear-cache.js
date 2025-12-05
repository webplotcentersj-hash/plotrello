#!/usr/bin/env node

/**
 * Script para limpiar todo tipo de cache
 * Uso: node scripts/clear-cache.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧹 Limpiando cache...\n');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para obtener el directorio de trabajo
function getCwd() {
  return process.cwd();
}

// Función para eliminar directorio de forma segura
function removeDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Función para eliminar archivo de forma segura
function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

let cleaned = 0;
const cwd = getCwd();

// 1. Limpiar dist/
log('📦 Limpiando carpeta dist/...', 'blue');
if (removeDir(path.join(cwd, 'dist'))) {
  log('  ✅ dist/ eliminada', 'green');
  cleaned++;
} else {
  log('  ℹ️  dist/ no existe', 'yellow');
}

// 2. Limpiar .vercel/
log('\n🔧 Limpiando cache de Vercel...', 'blue');
if (removeDir(path.join(cwd, '.vercel'))) {
  log('  ✅ .vercel/ eliminada', 'green');
  cleaned++;
} else {
  log('  ℹ️  .vercel/ no existe', 'yellow');
}

// 3. Limpiar node_modules/.vite
log('\n⚡ Limpiando cache de Vite...', 'blue');
const viteCache = path.join(cwd, 'node_modules', '.vite');
if (removeDir(viteCache)) {
  log('  ✅ Cache de Vite eliminada', 'green');
  cleaned++;
} else {
  log('  ℹ️  Cache de Vite no existe', 'yellow');
}

// 4. Limpiar .vite en la raíz (si existe)
const rootVite = path.join(cwd, '.vite');
if (removeDir(rootVite)) {
  log('  ✅ .vite/ eliminada', 'green');
  cleaned++;
}

// 5. Limpiar package-lock.json y reinstalar (opcional)
log('\n📦 Limpiando node_modules (opcional)...', 'blue');
const cleanNodeModules = process.argv.includes('--clean-node');
if (cleanNodeModules) {
  if (removeDir(path.join(cwd, 'node_modules'))) {
    log('  ✅ node_modules/ eliminada', 'green');
    cleaned++;
    log('  🔄 Reinstalando dependencias...', 'yellow');
    try {
      execSync('npm install', { stdio: 'inherit' });
      log('  ✅ Dependencias reinstaladas', 'green');
    } catch (error) {
      log('  ❌ Error al reinstalar dependencias', 'red');
    }
  }
} else {
  log('  ℹ️  Omitido (usa --clean-node para limpiar node_modules)', 'yellow');
}

// 6. Limpiar archivos temporales
log('\n🗑️  Limpiando archivos temporales...', 'blue');
const tempFiles = [
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  '.env.local',
  '.env.*.local'
];

tempFiles.forEach(pattern => {
  // Buscar archivos que coincidan con el patrón
  try {
    const files = fs.readdirSync(cwd);
    files.forEach(file => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(file)) {
          if (removeFile(path.join(cwd, file))) {
            log(`  ✅ ${file} eliminado`, 'green');
            cleaned++;
          }
        }
      } else if (file === pattern) {
        if (removeFile(path.join(cwd, file))) {
          log(`  ✅ ${file} eliminado`, 'green');
          cleaned++;
        }
      }
    });
  } catch (error) {
    // Ignorar errores
  }
});

// 7. Limpiar cache del navegador (instrucciones)
log('\n🌐 Cache del navegador:', 'blue');
log('  Para limpiar el cache del navegador:', 'yellow');
log('  - Chrome/Edge: Ctrl+Shift+Delete (Windows) o Cmd+Shift+Delete (Mac)', 'yellow');
log('  - Firefox: Ctrl+Shift+Delete (Windows) o Cmd+Shift+Delete (Mac)', 'yellow');
log('  - O usar modo incógnito: Ctrl+Shift+N (Chrome) o Ctrl+Shift+P (Firefox)', 'yellow');

// 8. Limpiar localStorage (instrucciones para el usuario)
log('\n💾 LocalStorage del navegador:', 'blue');
log('  Abre la consola del navegador (F12) y ejecuta:', 'yellow');
log('  localStorage.clear(); sessionStorage.clear();', 'yellow');

// Resumen
log('\n' + '='.repeat(50), 'blue');
if (cleaned > 0) {
  log(`✅ Cache limpiado: ${cleaned} elementos eliminados`, 'green');
} else {
  log('ℹ️  No se encontró cache para limpiar', 'yellow');
}
log('='.repeat(50) + '\n', 'blue');

log('💡 Tips adicionales:', 'blue');
log('  - Para limpiar node_modules también: node scripts/clear-cache.js --clean-node', 'yellow');
log('  - Para forzar rebuild sin cache: npm run build -- --force', 'yellow');
log('  - Para deploy sin cache en Vercel: vercel --prod --force', 'yellow');

