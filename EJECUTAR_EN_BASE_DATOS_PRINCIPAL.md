# ⚠️ IMPORTANTE: Ejecutar en la Base de Datos Principal

La base de datos principal es: **https://bwdtrzcdzbzrtykjzber.supabase.co**

## Pasos para aplicar los cambios:

### Opción 1: Desde el SQL Editor de Supabase

1. Ve a tu proyecto en Supabase: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo: `supabase/patches/2025-01-15_fix_compras_role_main_database.sql`
4. Ejecuta el script

### Opción 2: Configurar el MCP correctamente

El MCP debe estar configurado con estas credenciales:
- **URL**: `https://bwdtrzcdzbzrtykjzber.supabase.co`
- **ANON KEY**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZHRyemNkemJ6cnR5a2p6YmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDg1MTMsImV4cCI6MjA3OTEyNDUxM30.SSK0LDS0Y5XP-BdCzhtCeEKe0Iq7A2ArYnAcwCA6ebk`

Una vez configurado, puedo ejecutar la migración directamente.

## Lo que hace el script:

1. ✅ Actualiza el constraint de la tabla `usuarios` para incluir 'compras'
2. ✅ Actualiza la función `crear_usuario` para aceptar 'compras'
3. ✅ Crea/actualiza el usuario `fbergaglio@plotcenter.com.ar` con rol 'compras' y contraseña 'plot3819'

## Verificación después de ejecutar:

```sql
-- Verificar constraint
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.usuarios'::regclass 
  AND conname LIKE '%rol%';

-- Verificar función
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'crear_usuario';

-- Verificar usuario
SELECT id, nombre, rol 
FROM public.usuarios 
WHERE nombre = 'fbergaglio@plotcenter.com.ar';
```

