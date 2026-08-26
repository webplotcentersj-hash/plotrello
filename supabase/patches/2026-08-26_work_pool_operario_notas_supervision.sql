-- Panel supervisión bitácora/checklist/anotador (admin, gerencia, Alejandro id=6)
-- Applied via MCP: work_pool_operario_notas_supervision

CREATE OR REPLACE FUNCTION public.work_pool_actor_puede_ver_actividades_operarios(p_id_usuario integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_id_usuario
      AND COALESCE(u.activo, true) = true
      AND (
        lower(coalesce(u.rol, '')) IN ('administracion', 'administrador', 'admin', 'gerencia')
        OR u.id = 6
        OR lower(coalesce(u.nombre, '')) LIKE 'achavez@%'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.work_pool_operario_notas_supervision(
  p_id_actor integer,
  p_limit integer DEFAULT 120,
  p_id_operario integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lim integer := greatest(1, least(coalesce(p_limit, 120), 300));
BEGIN
  IF NOT public.work_pool_actor_puede_ver_actividades_operarios(p_id_actor) THEN
    RAISE EXCEPTION 'Sin permiso para ver actividades de operarios';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT
        n.id,
        n.id_usuario,
        n.tipo,
        n.titulo,
        n.detalle,
        n.hecho,
        n.id_job,
        n.numero_op,
        n.id_orden,
        n.id_venta,
        n.numero_venta,
        n.id_oportunidad,
        n.numero_oportunidad,
        n.created_at,
        n.updated_at,
        coalesce(
          nullif(trim(both from concat_ws(' ', l.nombre, l.apellido)), ''),
          CASE
            WHEN position('@' in coalesce(u.nombre, '')) > 1
              THEN split_part(u.nombre, '@', 1)
            ELSE u.nombre
          END,
          'Usuario #' || n.id_usuario
        ) AS usuario_nombre,
        u.rol AS usuario_rol,
        j.titulo AS job_titulo,
        j.estado AS job_estado
      FROM public.work_pool_operario_notas n
      LEFT JOIN public.usuarios u ON u.id = n.id_usuario
      LEFT JOIN public.legajos_empleados l ON l.id_usuario = n.id_usuario
      LEFT JOIN public.work_pool_jobs j ON j.id = n.id_job
      WHERE (p_id_operario IS NULL OR n.id_usuario = p_id_operario)
      ORDER BY n.created_at DESC
      LIMIT v_lim
    ) x
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_actor_puede_ver_actividades_operarios(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.work_pool_operario_notas_supervision(integer, integer, integer) TO authenticated, anon;
