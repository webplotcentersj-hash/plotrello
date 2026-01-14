-- Fix: Corregir función login_usuario para verificar correctamente las contraseñas
-- Problema: Los usuarios creados no pueden iniciar sesión porque la verificación de contraseña falla
-- Solución: Asegurar que la función use correctamente crypt() para verificar el hash bcrypt

BEGIN;

-- Asegurar que la extensión pgcrypto esté instalada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Actualizar la función login_usuario para verificar correctamente las contraseñas
CREATE OR REPLACE FUNCTION public.login_usuario(p_usuario text, p_password text)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_rec RECORD;
  stored_hash text;
  computed_hash text;
BEGIN
  -- Buscar usuario en la tabla usuarios
  SELECT u.id, u.nombre, u.rol, u.password_hash
    INTO user_rec
    FROM public.usuarios u
   WHERE lower(trim(u.nombre)) = lower(trim(p_usuario))
   LIMIT 1;

  -- Si no se encontró, retornar vacío
  IF NOT FOUND OR user_rec IS NULL THEN
    RETURN;
  END IF;

  -- Obtener el hash almacenado
  stored_hash := user_rec.password_hash;

  -- Si no hay hash almacenado, retornar vacío
  IF stored_hash IS NULL OR length(stored_hash) = 0 THEN
    RETURN;
  END IF;

  -- Verificar contraseña usando crypt
  -- crypt() con el hash almacenado como segundo parámetro extrae el salt automáticamente
  -- y genera un nuevo hash con la contraseña proporcionada
  computed_hash := crypt(p_password, stored_hash);

  -- Comparar el hash calculado con el almacenado
  IF computed_hash = stored_hash THEN
    RETURN QUERY SELECT 
      user_rec.id::integer, 
      user_rec.nombre::text, 
      user_rec.rol::text;
  END IF;

  -- Si no coincide, retornar vacío (sin error para no revelar si el usuario existe)
  RETURN;
END;
$$;

-- Dar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO authenticated;

COMMIT;

