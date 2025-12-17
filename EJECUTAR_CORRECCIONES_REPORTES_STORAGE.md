# ⚠️ EJECUTAR ESTAS CORRECCIONES EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Errores corregidos:

1. **Error en Reportes**: `column o.sector_asignado does not exist`
   - **Causa**: La función SQL usaba `sector_asignado` pero la columna correcta es `sector`
   - **Solución**: Se corrigió en `supabase/patches/2025-01-17_add_funciones_reportes_personal.sql`

2. **Error al subir foto**: `new row violates row-level security policy`
   - **Causa**: Las políticas de Storage eran muy restrictivas o no se ejecutaron
   - **Solución**: Se simplificaron las políticas en `supabase/patches/2025-01-17_add_politicas_storage_legajos.sql`

## Pasos para corregir:

### 1. Corregir funciones de reportes:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_add_funciones_reportes_personal.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

### 2. Corregir políticas de Storage:

1. En el mismo **SQL Editor**
2. Copia y pega el contenido del archivo `supabase/patches/2025-01-17_add_politicas_storage_legajos.sql`
3. Haz clic en **RUN** o presiona `Ctrl+Enter`
4. Verifica que se crearon las políticas correctamente

### 3. Verificar el bucket `legajos`:

1. Ve a **Storage** en el panel de Supabase
2. Verifica que el bucket `legajos` existe
3. Si no existe, créalo:
   - Haz clic en **New bucket**
   - Nombre: `legajos`
   - **Public bucket**: Puede estar activado o desactivado (las políticas lo manejan)
   - Haz clic en **Create bucket**

### 4. Verificar políticas creadas:

Ejecuta esta consulta en el SQL Editor para verificar:

```sql
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%legajos%';
```

Deberías ver 4 políticas:
- Permitir lectura de fotos de legajos (authenticated)
- Permitir lectura pública de fotos de legajos (public)
- Permitir subida de fotos de legajos (authenticated)
- Permitir actualización de fotos de legajos (authenticated)
- Permitir eliminación de fotos de legajos (authenticated)

## Nota importante:

Si después de ejecutar las políticas sigue habiendo problemas con la subida de fotos, puedes hacer el bucket `legajos` público temporalmente para probar, pero las políticas deberían funcionar correctamente.

