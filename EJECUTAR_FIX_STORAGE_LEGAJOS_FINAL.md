# Instrucciones para Corregir Políticas de Storage - Legajos

## Problema
Error de política RLS al subir fotos de empleados en el bucket `legajos`.

## Solución

### Opción 1: Verificar en Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Storage** → **Policies**
3. Selecciona el bucket `legajos`
4. Verifica que existan las siguientes políticas:

#### Política 1: Lectura para autenticados
- **Name**: `Permitir lectura de fotos de legajos`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**: `bucket_id = 'legajos'`

#### Política 2: Lectura pública
- **Name**: `Permitir lectura pública de fotos de legajos`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **USING expression**: `bucket_id = 'legajos'`

#### Política 3: Subida para autenticados
- **Name**: `Permitir subida de fotos de legajos`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **WITH CHECK expression**: 
  ```sql
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
  ```

#### Política 4: Actualización para autenticados
- **Name**: `Permitir actualización de fotos de legajos`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**: 
  ```sql
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
  ```
- **WITH CHECK expression**: 
  ```sql
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
  ```

#### Política 5: Eliminación para autenticados
- **Name**: `Permitir eliminación de fotos de legajos`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**: 
  ```sql
  bucket_id = 'legajos' AND
  (name LIKE 'empleados/%' OR name LIKE 'empleados%')
  ```

### Opción 2: Ejecutar SQL directamente

Si prefieres ejecutar el SQL directamente, ve a **SQL Editor** en Supabase Dashboard y ejecuta:

```sql
-- Verificar políticas actuales
SELECT 
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%legajo%'
ORDER BY policyname;
```

Si faltan políticas o están mal configuradas, ejecuta el archivo:
`supabase/patches/2025-01-20_fix_storage_legajos_policies_final.sql`

## Verificación

1. Asegúrate de estar **autenticado** en la aplicación
2. Intenta subir una foto en el legajo de un empleado
3. Si aún hay error, verifica en la consola del navegador (F12) los logs:
   - Debe mostrar: `📤 Subiendo foto: empleados/X.jpg Usuario: X Autenticado: true`
   - Si muestra `Autenticado: false`, el problema es de autenticación, no de políticas

## Notas Importantes

- El bucket `legajos` debe existir y estar configurado como **público** para lectura
- Los usuarios deben estar **autenticados** (no anónimos) para subir fotos
- Las fotos se guardan en la ruta: `empleados/{id_usuario}.{extensión}`
- Si el usuario no está autenticado, verás un error específico en la consola

