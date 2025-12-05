# Script PowerShell para limpiar cache en Windows
# Uso: .\scripts\clear-cache.ps1

Write-Host "🧹 Limpiando cache..." -ForegroundColor Blue
Write-Host ""

$cleaned = 0

# 1. Limpiar dist/
Write-Host "📦 Limpiando carpeta dist/..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "  ✅ dist/ eliminada" -ForegroundColor Green
    $cleaned++
} else {
    Write-Host "  ℹ️  dist/ no existe" -ForegroundColor Yellow
}

# 2. Limpiar .vercel/
Write-Host ""
Write-Host "🔧 Limpiando cache de Vercel..." -ForegroundColor Cyan
if (Test-Path ".vercel") {
    Remove-Item -Recurse -Force ".vercel"
    Write-Host "  ✅ .vercel/ eliminada" -ForegroundColor Green
    $cleaned++
} else {
    Write-Host "  ℹ️  .vercel/ no existe" -ForegroundColor Yellow
}

# 3. Limpiar node_modules/.vite
Write-Host ""
Write-Host "⚡ Limpiando cache de Vite..." -ForegroundColor Cyan
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "  ✅ Cache de Vite eliminada" -ForegroundColor Green
    $cleaned++
} else {
    Write-Host "  ℹ️  Cache de Vite no existe" -ForegroundColor Yellow
}

# 4. Limpiar .vite en la raíz
if (Test-Path ".vite") {
    Remove-Item -Recurse -Force ".vite"
    Write-Host "  ✅ .vite/ eliminada" -ForegroundColor Green
    $cleaned++
}

# 5. Limpiar archivos temporales
Write-Host ""
Write-Host "🗑️  Limpiando archivos temporales..." -ForegroundColor Cyan
$tempFiles = @(".DS_Store", "Thumbs.db")
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        Remove-Item -Force $file
        Write-Host "  ✅ $file eliminado" -ForegroundColor Green
        $cleaned++
    }
}

# Limpiar archivos .log
Get-ChildItem -Path . -Filter "*.log" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Force $_.FullName
    Write-Host "  ✅ $($_.Name) eliminado" -ForegroundColor Green
    $cleaned++
}

# 6. Verificar si se quiere limpiar node_modules
if ($args -contains "--clean-node") {
    Write-Host ""
    Write-Host "📦 Limpiando node_modules..." -ForegroundColor Cyan
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules"
        Write-Host "  ✅ node_modules/ eliminada" -ForegroundColor Green
        $cleaned++
        Write-Host "  🔄 Reinstalando dependencias..." -ForegroundColor Yellow
        npm install
        Write-Host "  ✅ Dependencias reinstaladas" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  Para limpiar node_modules también: .\scripts\clear-cache.ps1 --clean-node" -ForegroundColor Yellow
}

# Resumen
Write-Host ""
Write-Host ("=" * 50) -ForegroundColor Blue
if ($cleaned -gt 0) {
    Write-Host "✅ Cache limpiado: $cleaned elementos eliminados" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No se encontró cache para limpiar" -ForegroundColor Yellow
}
Write-Host ("=" * 50) -ForegroundColor Blue
Write-Host ""

Write-Host "💡 Tips adicionales:" -ForegroundColor Blue
Write-Host "  - Para limpiar node_modules: .\scripts\clear-cache.ps1 --clean-node" -ForegroundColor Yellow
Write-Host "  - Para forzar rebuild: npm run build -- --force" -ForegroundColor Yellow
Write-Host "  - Para deploy sin cache: vercel --prod --force" -ForegroundColor Yellow
Write-Host ""
Write-Host "🌐 Para limpiar cache del navegador:" -ForegroundColor Blue
Write-Host "  - Chrome/Edge: Ctrl+Shift+Delete" -ForegroundColor Yellow
Write-Host "  - O usar modo incógnito: Ctrl+Shift+N" -ForegroundColor Yellow

