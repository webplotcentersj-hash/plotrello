# 🚀 Instrucciones para Reflejar Cambios en Producción

## ⚠️ Problema: Los cambios no se reflejan

Si los cambios no se ven en producción, sigue estos pasos:

### 1. Limpiar Cache del Navegador

**En Chrome/Edge:**
- Presiona `Ctrl + Shift + Delete` (Windows) o `Cmd + Shift + Delete` (Mac)
- Selecciona "Caché" y "Imágenes y archivos en caché"
- Haz clic en "Borrar datos"

**O usa modo incógnito:**
- `Ctrl + Shift + N` (Chrome) o `Ctrl + Shift + P` (Firefox)
- Abre la aplicación en modo incógnito

**O desde la consola del navegador (F12):**
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

### 2. Verificar que Vercel haya Desplegado

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Busca tu proyecto
3. Verifica que el último deployment tenga el commit más reciente
4. Si no está actualizado, haz clic en "Redeploy" en el último deployment

### 3. Forzar Redeploy en Vercel

**Opción A: Desde el Dashboard**
1. Ve a tu proyecto en Vercel
2. Haz clic en "Deployments"
3. Encuentra el último deployment
4. Haz clic en los tres puntos (⋯) → "Redeploy"
5. Selecciona "Use existing Build Cache" = NO (para forzar rebuild)

**Opción B: Desde la CLI**
```bash
vercel login
vercel --prod --force
```

### 4. Verificar Variables de Entorno en Vercel

1. Ve a Settings → Environment Variables
2. Verifica que todas las variables estén configuradas:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_SCHEMA`
3. Si cambiaste alguna variable, haz un **Redeploy**

### 5. Verificar que los Scripts SQL se Ejecutaron

Los scripts SQL deben ejecutarse manualmente en Supabase:
- ✅ `2024-11-24_corregir_logica_duplicacion_fichas.sql`
- ✅ `2024-11-24_fix_get_users_by_sector_type.sql`
- ✅ `2024-11-24_fix_ultimo_create_orden_type_mismatch.sql`

### 6. Cambios Recientes que Deberían Verse

**Frontend:**
- El sector inicial puede ser cualquier sector (no necesita estar en sectores seleccionados)
- Validación actualizada para permitir crear fichas sin sectores seleccionados

**Backend:**
- Duplicación solo con 2+ sectores
- No duplica al mover fichas
- Unificación en "Finalizado en Taller"

### 7. Verificar en el Navegador

1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña "Network"
3. Marca "Disable cache"
4. Recarga la página (Ctrl + F5 o Cmd + Shift + R)

### 8. Si Aún No Funciona

1. Verifica los logs de Vercel en el dashboard
2. Revisa la consola del navegador para errores
3. Verifica que el build local funcione: `npm run build`
4. Compara el código local con el desplegado

---

## 📝 Checklist de Verificación

- [ ] Cache del navegador limpiado
- [ ] Vercel tiene el último commit desplegado
- [ ] Variables de entorno configuradas en Vercel
- [ ] Scripts SQL ejecutados en Supabase
- [ ] Build local funciona sin errores
- [ ] Modo incógnito muestra los cambios
- [ ] Consola del navegador sin errores

