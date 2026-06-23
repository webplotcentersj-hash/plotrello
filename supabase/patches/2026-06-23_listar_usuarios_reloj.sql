-- Vinculo reloj → asistencia: incluir usuarios inactivos (baja) para matchear planillas históricas.
CREATE OR REPLACE FUNCTION public.listar_usuarios_reloj()
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.nombre, u.rol
  FROM public.usuarios u
  ORDER BY COALESCE(u.activo, true) DESC, u.nombre;
$$;

GRANT EXECUTE ON FUNCTION public.listar_usuarios_reloj() TO authenticated;
