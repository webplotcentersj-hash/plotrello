# 🧹 Guía para Limpiar Cache

Este proyecto incluye varias herramientas para eliminar cache en diferentes niveles.

## 🚀 Uso Rápido

### Limpiar cache local
```bash
npm run clear-cache
```

### Limpiar cache y rebuild
```bash
npm run clean
```

### Limpiar TODO (incluyendo node_modules)
```bash
npm run clean-all
```

## 📋 Scripts Disponibles

### `npm run clear-cache`
Limpia:
- ✅ Carpeta `dist/`
- ✅ Cache de Vercel (`.vercel/`)
- ✅ Cache de Vite (`node_modules/.vite` y `.vite/`)
- ✅ Archivos temporales (`.log`, `.DS_Store`, etc.)

### `npm run clean`
Ejecuta `clear-cache` y luego hace un rebuild completo.

### `npm run clean-all`
Limpia todo incluyendo `node_modules/` y reinstala dependencias.

## 🔧 Scripts Manuales

### Node.js (Multiplataforma)
```bash
node scripts/clear-cache.js
node scripts/clear-cache.js --clean-node  # Incluye node_modules
```

### PowerShell (Windows)
```powershell
.\scripts\clear-cache.ps1
.\scripts\clear-cache.ps1 --clean-node  # Incluye node_modules
```

## 🌐 Limpiar Cache del Navegador

### Método 1: Atajos de teclado
- **Chrome/Edge**: `Ctrl+Shift+Delete` (Windows) o `Cmd+Shift+Delete` (Mac)
- **Firefox**: `Ctrl+Shift+Delete` (Windows) o `Cmd+Shift+Delete` (Mac)

### Método 2: Modo Incógnito
- **Chrome/Edge**: `Ctrl+Shift+N` (Windows) o `Cmd+Shift+N` (Mac)
- **Firefox**: `Ctrl+Shift+P` (Windows) o `Cmd+Shift+P` (Mac)

### Método 3: Consola del Navegador
Abre la consola (F12) y ejecuta:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## 🚢 Deploy sin Cache en Vercel

### Forzar deploy sin cache
```bash
vercel --prod --force
```

### Limpiar cache de Vercel localmente
```bash
npm run clear-cache
# Luego hacer commit y push
```

## ⚙️ Configuración Anti-Cache

El proyecto está configurado para minimizar problemas de cache:

### `vercel.json`
- Headers `Cache-Control: no-cache` para archivos HTML
- Headers de cache para assets estáticos (con hash)

### `vite.config.ts`
- Nombres de archivos con hash para evitar cache
- Build optimizado sin cache

## 🔍 Verificar Cache

### En el navegador
1. Abre DevTools (F12)
2. Ve a la pestaña **Network**
3. Marca "Disable cache"
4. Recarga la página (Ctrl+R o Cmd+R)

### En Vercel
1. Ve a tu proyecto en Vercel
2. Settings → Build & Development Settings
3. Verifica que "Build Command" y "Output Directory" sean correctos

## 📝 Notas

- El cache de Vite se regenera automáticamente al hacer `npm run dev`
- El cache de Vercel se limpia automáticamente en cada deploy
- Los archivos con hash (ej: `index.abc123.js`) no necesitan limpieza manual
- Si persisten problemas, usa `npm run clean-all` para limpiar todo

## 🆘 Solución de Problemas

### "Los cambios no se ven"
1. Ejecuta `npm run clear-cache`
2. Limpia cache del navegador (Ctrl+Shift+Delete)
3. Recarga con Ctrl+F5 (hard refresh)

### "Error en build"
1. Ejecuta `npm run clean-all`
2. Verifica que todas las dependencias estén instaladas
3. Revisa los logs de error

### "Vercel muestra versión antigua"
1. Ejecuta `vercel --prod --force`
2. O haz un commit vacío: `git commit --allow-empty -m "Force rebuild" && git push`

