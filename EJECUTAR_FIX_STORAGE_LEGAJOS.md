# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Problema:
- Error al subir fotos: "new row violates row-level security policy"
- Errores de lógica al guardar legajos (falta validación de campos requeridos)

## Solución:

### 1. Corregir políticas de Storage:

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-20_fix_storage_legajos_policies.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

### 2. Verificar el bucket `legajos`:

1. Ve a **Storage** en el panel de Supabase
2. Verifica que el bucket `legajos` existe
3. Si no existe, créalo:
   - Haz clic en **New bucket**
   - Nombre: `legajos`
   - **Public bucket**: Puede estar activado o desactivado (las políticas lo manejan)
   - Haz clic en **Create bucket**

### 3. Verificar políticas creadas:

Ejecuta esta consulta en el SQL Editor para verificar:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%legajos%';
```

Deberías ver 5 políticas:
- Permitir lectura de fotos de legajos (authenticated)
- Permitir lectura pública de fotos de legajos (public)
- Permitir subida de fotos de legajos (authenticated) - **IMPORTANTE: debe tener restricción de carpeta empleados/**
- Permitir actualización de fotos de legajos (authenticated)
- Permitir eliminación de fotos de legajos (authenticated)

## Cambios en el código:

1. **Validación de campos requeridos**: Ahora se valida que el nombre y fecha de ingreso estén presentes antes de guardar
2. **Mejor manejo de errores**: Mensajes de error más descriptivos para problemas de Storage
3. **Limpieza de inputs**: Los inputs de archivo se limpian después de procesar

## Nota importante:

Si después de ejecutar el parche aún hay errores, verifica:
1. Que el bucket `legajos` esté creado
2. Que las políticas RLS estén activadas en el bucket
3. Que el usuario esté autenticado correctamente

