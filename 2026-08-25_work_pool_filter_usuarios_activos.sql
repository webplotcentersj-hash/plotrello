-- Filtra IDs de usuarios activos (SECURITY DEFINER) para excluir dados de baja del admin work-pool.
CREATE OR REPLACE FUNCTION public.work_pool_filter_usuarios_activos(p_ids integer[])
RETURNS integer[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(u.id ORDER BY u.id), ARRAY[]::integer[])
  FROM public.usuarios u
  WHERE u.id = ANY(COALESCE(p_ids, ARRAY[]::integer[]))
    AND COALESCE(u.activo, true) = true;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_filter_usuarios_activos(integer[]) TO authenticated, anon;

COMMENT ON FUNCTION public.work_pool_filter_usuarios_activos(integer[]) IS
  'Devuelve solo IDs activos de la lista (bypass RLS) para excluir dados de baja del admin work-pool.';
