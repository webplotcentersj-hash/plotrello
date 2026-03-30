-- operario_asignado (y similares) pueden venir como id de usuario en texto ("42")
-- desde el front; las notificaciones usan get_user_id_from_nombre y fallaban al buscar por nombre.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_id_from_nombre(nombre_usuario text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id_result integer;
  nombre_limpio text;
  usuarios_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
  ) INTO usuarios_exists;

  IF NOT usuarios_exists THEN
    RETURN NULL;
  END IF;

  nombre_limpio := trim(lower(nombre_usuario));

  IF nombre_limpio IS NULL OR nombre_limpio = '' THEN
    RETURN NULL;
  END IF;

  -- Resolver por id numérico (mismo criterio que el select de operario en crear/editar ficha)
  IF nombre_limpio ~ '^[0-9]+$' THEN
    SELECT u.id INTO user_id_result
    FROM public.usuarios u
    WHERE u.id::text = nombre_limpio
    LIMIT 1;
    IF user_id_result IS NOT NULL THEN
      RETURN user_id_result;
    END IF;
  END IF;

  SELECT id INTO user_id_result
  FROM public.usuarios
  WHERE lower(trim(nombre)) = nombre_limpio
  LIMIT 1;

  IF user_id_result IS NULL AND nombre_limpio LIKE '%@%' THEN
    SELECT id INTO user_id_result
    FROM public.usuarios
    WHERE lower(trim(nombre)) LIKE '%' || split_part(nombre_limpio, '@', 1) || '%'
    LIMIT 1;
  END IF;

  RETURN user_id_result;
END;
$$;

COMMIT;
