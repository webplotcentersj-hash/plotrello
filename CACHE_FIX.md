# Solución de Problemas de Caché

## Si no ves los cambios en la aplicación

### 1. Limpiar caché del navegador

**Chrome/Edge:**
- Presiona `Ctrl + Shift + Delete`
- Selecciona "Caché e imágenes almacenadas"
- Haz clic en "Borrar datos"

**O forzar recarga:**
- Presiona `Ctrl + Shift + R` (Windows/Linux)
- Presiona `Cmd + Shift + R` (Mac)

### 2. Verificar que el despliegue se completó

1. Ve a Vercel Dashboard
2. Verifica que el último deployment esté en estado "Ready"
3. Si hay un deployment en progreso, espera a que termine

### 3. Verificar cambios en la consola del navegador

1. Abre las herramientas de desarrollador (`F12`)
2. Ve a la pestaña "Console"
3. Busca errores en rojo
4. Verifica que los sectores se carguen correctamente

### 4. Verificar cambios en Network

1. Abre las herramientas de desarrollador (`F12`)
2. Ve a la pestaña "Network"
3. Recarga la página (`Ctrl + Shift + R`)
4. Verifica que los archivos JS/CSS tengan nombres con hash (ej: `index.ABC123.js`)

### 5. Verificar variables de entorno

En la consola del navegador deberías ver:
```
🔍 Variables de Entorno:
VITE_SUPABASE_URL: ✅ Configurada
VITE_SUPABASE_ANON_KEY: ✅ Configurada
```

## Cambios recientes aplicados

✅ **Backend (SQL):**
- Función `crear_fichas_por_sector()` actualizada
- Trigger `trigger_sincronizar_duplicados` corregido (no bloquea movimiento)
- Todos los sectores del Kanban están en la BD

✅ **Frontend:**
- Filtrado de sectores por columnas del Kanban
- "Metalúrgica" incluida en la lista
- Eliminado "Sector inicial" del formulario

## Si el problema persiste

1. **Verifica que estés en la URL correcta** (la desplegada en Vercel, no localhost)
2. **Prueba en modo incógnito** para evitar extensiones que interfieran
3. **Verifica la consola** por errores de JavaScript
4. **Revisa Network** para ver si hay requests fallando

