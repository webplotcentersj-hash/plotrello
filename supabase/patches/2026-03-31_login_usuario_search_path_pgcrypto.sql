-- login_usuario: crypt() debe resolver contra pgcrypto (schema extensions).
-- Sin SET search_path, SECURITY DEFINER a veces no encuentra crypt → login siempre falla
-- aunque usuario y contraseña sean correctos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.login_usuario(p_usuario text, p_password text)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  SELECT u.id, u.nombre, u.rol, u.password_hash
    INTO user_rec
    FROM public.usuarios u
   WHERE lower(trim(u.nombre)) = lower(trimmed_usuario)
   LIMIT 1;

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
  IF stored_hash IS NULL OR length(trim(stored_hash)) = 0 THEN
    RETURN;
  END IF;

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

COMMENT ON FUNCTION public.login_usuario(text, text) IS
  'Login Plotrello: verifica password_hash con pgcrypto (bf). Requiere search_path extensions.';

GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_usuario(text, text) TO authenticated;
