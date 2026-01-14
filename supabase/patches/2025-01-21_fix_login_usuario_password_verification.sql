-- Fix: Corregir función login_usuario para verificar correctamente las contraseñas
-- Problema: Los usuarios creados no pueden iniciar sesión porque la verificación de contraseña falla
-- Solución: Asegurar que la función use correctamente crypt() para verificar el hash bcrypt

BEGIN;

-- Asegurar que la extensión pgcrypto esté instalada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Eliminar la función existente para poder recrearla con el tipo de retorno correcto
DROP FUNCTION IF EXISTS public.login_usuario(text, text);

-- Crear la función login_usuario para verificar correctamente las contraseñas
-- y ser tolerante a passwords con espacios accidentales (compatibilidad)
CREATE OR REPLACE FUNCTION public.login_usuario(p_usuario text, p_password text)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_rec RECORD;
  stored_hash text;
  computed_hash_raw text;
  computed_hash_trim text;
  trimmed_usuario text;
  autentificacion_exists boolean;
BEGIN
  trimmed_usuario := trim(p_usuario);

  IF trimmed_usuario = '' OR p_password IS NULL OR length(p_password) = 0 THEN
    RETURN;
  END IF;

  -- Verificar si existe la tabla autentificacion (algunas bases la tienen)
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  -- Buscar usuario en la tabla usuarios
  SELECT u.id, u.nombre, u.rol, u.password_hash
    INTO user_rec
    FROM public.usuarios u
   WHERE lower(trim(u.nombre)) = lower(trimmed_usuario)
   LIMIT 1;

  -- Si no está en usuarios y existe autentificacion, buscar ahí
  IF NOT FOUND AND autentificacion_exists THEN
    BEGIN
      EXECUTE format(
        'SELECT a.id, a.nombre, a.rol, a.password_hash
         FROM public.autentificacion a
         WHERE lower(trim(a.nombre)) = lower(%L)
         LIMIT 1',
        trimmed_usuario
      ) INTO user_rec;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF user_rec IS NULL THEN
    RETURN;
  END IF;

  stored_hash := user_rec.password_hash;
  IF stored_hash IS NULL OR length(stored_hash) = 0 THEN
    RETURN;
  END IF;

  -- Compatibilidad: probar password tal cual y también trim(password)
  computed_hash_raw := crypt(p_password, stored_hash);
  computed_hash_trim := crypt(trim(p_password), stored_hash);

  IF computed_hash_raw = stored_hash OR computed_hash_trim = stored_hash THEN
    RETURN QUERY SELECT
      user_rec.id::integer,
      user_rec.nombre::text,
      user_rec.rol::text;
  END IF;

  RETURN;
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO authenticated;

COMMIT;

