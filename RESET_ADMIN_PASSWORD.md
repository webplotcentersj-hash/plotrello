# Resetear Usuario Admin

## Problema
El usuario admin desapareció o la contraseña no funciona.

## Solución Rápida

### Opción 1: Ejecutar el Patch SQL (Recomendado)

1. Ve a tu proyecto en Supabase Dashboard
2. Abre el SQL Editor
3. Ejecuta el archivo: `supabase/patches/2025-01-27_create_or_reset_admin_user.sql`

Esto creará o reseteará el usuario admin con:
- **Usuario**: `admin`
- **Contraseña**: `admin123`
- **Rol**: `administracion`

### Opción 2: Ejecutar SQL Directo

Ejecuta este SQL en el SQL Editor de Supabase:

```sql
-- Asegurar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Crear o actualizar usuario admin
DO $$
DECLARE
  admin_id integer;
  password_hash text;
BEGIN
  -- Generar hash de contraseña (contraseña: admin123)
  password_hash := crypt('admin123', gen_salt('bf', 10));

  -- Buscar si existe usuario admin
  SELECT id INTO admin_id
  FROM public.usuarios
  WHERE lower(trim(nombre)) = 'admin' 
     OR rol = 'administracion'
  LIMIT 1;

  IF admin_id IS NOT NULL THEN
    -- Actualizar usuario existente
    UPDATE public.usuarios
    SET 
      password_hash = password_hash,
      rol = 'administracion',
      nombre = 'admin'
    WHERE id = admin_id;
    
    RAISE NOTICE 'Usuario admin actualizado. ID: %', admin_id;
  ELSE
    -- Crear nuevo usuario admin
    INSERT INTO public.usuarios (nombre, rol, password_hash)
    VALUES ('admin', 'administracion', password_hash)
    RETURNING id INTO admin_id;
    
    RAISE NOTICE 'Usuario admin creado. ID: %', admin_id;
  END IF;
END;
$$;

-- Verificar que se creó correctamente
SELECT id, nombre, rol, 
       CASE WHEN password_hash IS NULL OR length(password_hash) = 0 
            THEN 'SIN CONTRASEÑA' 
            ELSE 'CON CONTRASEÑA' 
       END as estado_password
FROM public.usuarios
WHERE lower(trim(nombre)) = 'admin' 
   OR rol = 'administracion';
```

### Opción 3: Cambiar Contraseña de Usuario Existente

Si el usuario admin existe pero querés cambiarle la contraseña:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

UPDATE public.usuarios
SET password_hash = crypt('TU_NUEVA_CONTRASEÑA', gen_salt('bf', 10))
WHERE lower(trim(nombre)) = 'admin'
   OR rol = 'administracion';
```

## Credenciales por Defecto

Después de ejecutar el script:

- **Usuario**: `admin`
- **Contraseña**: `admin123`
- **Rol**: `administracion`

**⚠️ IMPORTANTE**: Cambiá la contraseña después del primer login por seguridad.

## Verificar Usuario Admin

Para verificar que el usuario admin existe y tiene contraseña:

```sql
SELECT 
  id,
  nombre,
  rol,
  CASE 
    WHEN password_hash IS NULL OR length(password_hash) = 0 
    THEN 'SIN CONTRASEÑA' 
    ELSE 'CON CONTRASEÑA' 
  END as estado_password,
  created_at
FROM public.usuarios
WHERE lower(trim(nombre)) = 'admin' 
   OR rol = 'administracion';
```

## Solución de Problemas

### Si el login sigue fallando:

1. **Verificar que el usuario existe**:
   ```sql
   SELECT * FROM public.usuarios WHERE nombre = 'admin';
   ```

2. **Verificar que tiene password_hash**:
   ```sql
   SELECT nombre, rol, 
          CASE WHEN password_hash IS NULL THEN 'NULL' 
               WHEN length(password_hash) = 0 THEN 'VACÍO'
               ELSE 'OK' 
          END as estado
   FROM public.usuarios 
   WHERE nombre = 'admin';
   ```

3. **Verificar la función login_usuario**:
   ```sql
   SELECT proname, prosrc 
   FROM pg_proc 
   WHERE proname = 'login_usuario';
   ```

4. **Probar login directamente**:
   ```sql
   SELECT * FROM public.login_usuario('admin', 'admin123');
   ```

### Si necesitás crear un usuario admin con otro nombre:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO public.usuarios (nombre, rol, password_hash)
VALUES ('TU_NOMBRE_USUARIO', 'administracion', crypt('TU_CONTRASEÑA', gen_salt('bf', 10)))
ON CONFLICT DO NOTHING;
```

## Notas

- El hash de contraseña usa bcrypt con factor de costo 10
- La función `login_usuario` verifica las contraseñas usando `crypt()`
- Los usuarios con rol `administracion` o `gerencia` pueden acceder al Panel Admin

