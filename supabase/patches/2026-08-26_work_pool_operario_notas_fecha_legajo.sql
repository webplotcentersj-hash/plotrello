-- Filtro por fecha, id legajo y consulta desde legajo RRHH

CREATE OR REPLACE FUNCTION public.work_pool_operario_notas_supervision(
  p_id_actor integer,
  p_limit integer DEFAULT 120,
  p_id_operario integer DEFAULT NULL,
  p_fecha date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lim integer := greatest(1, least(coalesce(p_limit, 120), 500));
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
        n.adjuntos,
        n.hora_inicio,
        n.hora_fin,
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
        j.estado AS job_estado,
        l.id AS id_legajo
      FROM public.work_pool_operario_notas n
      LEFT JOIN public.usuarios u ON u.id = n.id_usuario
      LEFT JOIN public.legajos_empleados l ON l.id_usuario = n.id_usuario
      LEFT JOIN public.work_pool_jobs j ON j.id = n.id_job
      WHERE (p_id_operario IS NULL OR n.id_usuario = p_id_operario)
        AND (
          p_fecha IS NULL
          OR (n.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = p_fecha
        )
      ORDER BY n.created_at DESC
      LIMIT v_lim
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_actor_puede_ver_notas_operario(
  p_id_actor integer,
  p_id_operario integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_id_actor = p_id_operario
    OR public.work_pool_actor_puede_ver_actividades_operarios(p_id_actor)
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = p_id_actor
        AND COALESCE(u.activo, true) = true
        AND lower(coalesce(u.rol, '')) IN (
          'recursos-humanos', 'administracion', 'administrador', 'admin', 'gerencia'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.work_pool_operario_notas_legajo(
  p_id_actor integer,
  p_id_usuario integer,
  p_fecha date DEFAULT NULL,
  p_limit integer DEFAULT 80
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lim integer := greatest(1, least(coalesce(p_limit, 80), 200));
BEGIN
  IF NOT public.work_pool_actor_puede_ver_notas_operario(p_id_actor, p_id_usuario) THEN
    RAISE EXCEPTION 'Sin permiso para ver actividades del legajo';
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
        n.adjuntos,
        n.hora_inicio,
        n.hora_fin,
        n.created_at,
        n.updated_at,
        j.titulo AS job_titulo,
        j.estado AS job_estado
      FROM public.work_pool_operario_notas n
      LEFT JOIN public.work_pool_jobs j ON j.id = n.id_job
      WHERE n.id_usuario = p_id_usuario
        AND (
          p_fecha IS NULL
          OR (n.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = p_fecha
        )
      ORDER BY n.created_at DESC
      LIMIT v_lim
    ) x
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_operario_notas_supervision(integer, integer, integer, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.work_pool_operario_notas_legajo(integer, integer, date, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.work_pool_actor_puede_ver_notas_operario(integer, integer) TO authenticated, anon;
