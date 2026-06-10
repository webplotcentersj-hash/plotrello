-- Nombres de usuarios por ID (p. ej. interlocutores en mensajería DM), incluye inactivos.

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_usuarios_por_ids(p_ids integer[])
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.rol
  FROM public.usuarios u
  WHERE u.id = ANY(COALESCE(p_ids, ARRAY[]::integer[]))
  ORDER BY u.nombre;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_usuarios_por_ids(integer[]) TO anon, authenticated;

COMMIT;
