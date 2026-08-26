-- Bitácora: adjuntos + horario por tarea + estadísticas supervisión

ALTER TABLE public.work_pool_operario_notas
  ADD COLUMN IF NOT EXISTS adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fin time;

COMMENT ON COLUMN public.work_pool_operario_notas.adjuntos IS
  'Array JSON [{nombre, url, mime?, size?}] — solo bitácora';
COMMENT ON COLUMN public.work_pool_operario_notas.hora_inicio IS 'Horario de inicio de la actividad (mismo día que created_at)';
COMMENT ON COLUMN public.work_pool_operario_notas.hora_fin IS 'Horario de fin (opcional)';

CREATE OR REPLACE FUNCTION public.work_pool_operario_nota_crear(
  p_id_usuario integer,
  p_tipo text,
  p_detalle text,
  p_titulo text DEFAULT NULL,
  p_id_job integer DEFAULT NULL,
  p_numero_op text DEFAULT NULL,
  p_id_venta integer DEFAULT NULL,
  p_numero_venta text DEFAULT NULL,
  p_id_oportunidad integer DEFAULT NULL,
  p_numero_oportunidad text DEFAULT NULL,
  p_adjuntos jsonb DEFAULT '[]'::jsonb,
  p_hora_inicio time DEFAULT NULL,
  p_hora_fin time DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.work_pool_jobs%ROWTYPE;
  v_id integer;
  v_numero_op text := nullif(trim(coalesce(p_numero_op, '')), '');
  v_id_orden integer := NULL;
  v_adjuntos jsonb := coalesce(p_adjuntos, '[]'::jsonb);
BEGIN
  IF p_id_usuario IS NULL OR coalesce(trim(p_tipo), '') = '' THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;
  IF p_tipo NOT IN ('bitacora', 'anotador', 'checklist') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;
  IF coalesce(trim(p_detalle), '') = '' AND coalesce(trim(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'Escribí una nota o título';
  END IF;
  IF jsonb_typeof(v_adjuntos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Adjuntos inválidos';
  END IF;
  IF p_tipo <> 'bitacora' AND v_adjuntos <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Los adjuntos solo aplican a bitácora';
  END IF;
  IF p_hora_fin IS NOT NULL AND p_hora_inicio IS NULL THEN
    RAISE EXCEPTION 'Indicá hora de inicio';
  END IF;
  IF p_hora_inicio IS NOT NULL AND p_hora_fin IS NOT NULL AND p_hora_fin < p_hora_inicio THEN
    RAISE EXCEPTION 'La hora de fin debe ser posterior al inicio';
  END IF;

  IF p_id_job IS NOT NULL THEN
    SELECT * INTO v_job FROM public.work_pool_jobs WHERE id = p_id_job;
    IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
    IF v_job.id_usuario_asignado IS DISTINCT FROM p_id_usuario
       AND v_job.estado = 'disponible' THEN
      RAISE EXCEPTION 'Tomá el trabajo antes de anotar en la bitácora';
    END IF;
    IF v_job.id_usuario_asignado IS DISTINCT FROM p_id_usuario
       AND v_job.estado <> 'disponible' THEN
      RAISE EXCEPTION 'No sos el asignado de este trabajo';
    END IF;
    IF v_numero_op IS NULL THEN v_numero_op := v_job.numero_op; END IF;
    v_id_orden := v_job.id_orden;
  END IF;

  IF v_numero_op IS NOT NULL AND v_id_orden IS NULL THEN
    SELECT o.id INTO v_id_orden FROM public.ordenes_trabajo o
    WHERE o.numero_op = v_numero_op
    ORDER BY o.id DESC LIMIT 1;
  END IF;

  INSERT INTO public.work_pool_operario_notas (
    id_usuario, tipo, titulo, detalle, hecho,
    id_job, numero_op, id_orden,
    id_venta, numero_venta, id_oportunidad, numero_oportunidad,
    adjuntos, hora_inicio, hora_fin
  ) VALUES (
    p_id_usuario, p_tipo,
    nullif(trim(coalesce(p_titulo, '')), ''),
    trim(coalesce(p_detalle, '')),
    false,
    p_id_job, v_numero_op, v_id_orden,
    p_id_venta, nullif(trim(coalesce(p_numero_venta, '')), ''),
    p_id_oportunidad, nullif(trim(coalesce(p_numero_oportunidad, '')), ''),
    v_adjuntos, p_hora_inicio, p_hora_fin
  )
  RETURNING id INTO v_id;

  IF p_id_job IS NOT NULL AND p_tipo = 'bitacora' THEN
    INSERT INTO public.work_pool_job_events (id_job, tipo, detalle, id_usuario)
    VALUES (p_id_job, 'nota', left(trim(coalesce(p_detalle, p_titulo, '')), 500), p_id_usuario);
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_operario_nota_listar(
  p_id_usuario integer,
  p_tipo text DEFAULT NULL,
  p_id_job integer DEFAULT NULL,
  p_limit integer DEFAULT 80
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT n.id, n.id_usuario, n.tipo, n.titulo, n.detalle, n.hecho,
             n.id_job, n.numero_op, n.id_orden,
             n.id_venta, n.numero_venta, n.id_oportunidad, n.numero_oportunidad,
             n.adjuntos, n.hora_inicio, n.hora_fin,
             n.created_at, n.updated_at
      FROM public.work_pool_operario_notas n
      WHERE n.id_usuario = p_id_usuario
        AND (p_tipo IS NULL OR n.tipo = p_tipo)
        AND (p_id_job IS NULL OR n.id_job = p_id_job)
      ORDER BY n.created_at DESC
      LIMIT greatest(1, least(coalesce(p_limit, 80), 200))
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_operario_nota_listar_job(
  p_id_job integer,
  p_limit integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT n.id, n.id_usuario, n.tipo, n.titulo, n.detalle, n.hecho,
             n.id_job, n.numero_op, n.id_orden,
             n.id_venta, n.numero_venta, n.id_oportunidad, n.numero_oportunidad,
             n.adjuntos, n.hora_inicio, n.hora_fin,
             n.created_at, n.updated_at,
             u.nombre AS usuario_nombre
      FROM public.work_pool_operario_notas n
      LEFT JOIN public.usuarios u ON u.id = n.id_usuario
      WHERE n.id_job = p_id_job
      ORDER BY n.created_at DESC
      LIMIT greatest(1, least(coalesce(p_limit, 60), 200))
    ) x
  ), '[]'::jsonb);
END;
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

CREATE OR REPLACE FUNCTION public.work_pool_operario_notas_estadisticas(
  p_id_actor integer,
  p_dias integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
  v_desde timestamptz := date_trunc('day', now()) - ((v_dias - 1) || ' days')::interval;
BEGIN
  IF NOT public.work_pool_actor_puede_ver_actividades_operarios(p_id_actor) THEN
    RAISE EXCEPTION 'Sin permiso para ver estadísticas';
  END IF;

  RETURN jsonb_build_object(
    'periodo_dias', v_dias,
    'totales', (
      SELECT jsonb_build_object(
        'total', count(*)::int,
        'bitacora', count(*) FILTER (WHERE n.tipo = 'bitacora')::int,
        'checklist', count(*) FILTER (WHERE n.tipo = 'checklist')::int,
        'anotador', count(*) FILTER (WHERE n.tipo = 'anotador')::int,
        'checklist_hechos', count(*) FILTER (WHERE n.tipo = 'checklist' AND n.hecho)::int,
        'con_adjuntos', count(*) FILTER (WHERE jsonb_array_length(n.adjuntos) > 0)::int,
        'con_horario', count(*) FILTER (WHERE n.hora_inicio IS NOT NULL)::int,
        'minutos_registrados', coalesce(sum(
          CASE
            WHEN n.hora_inicio IS NOT NULL AND n.hora_fin IS NOT NULL
              THEN extract(epoch FROM (n.hora_fin - n.hora_inicio)) / 60
            ELSE 0
          END
        ), 0)::int
      )
      FROM public.work_pool_operario_notas n
      WHERE n.created_at >= v_desde
    ),
    'por_operario', coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total DESC, x.nombre)
      FROM (
        SELECT
          n.id_usuario,
          coalesce(
            nullif(trim(both from concat_ws(' ', l.nombre, l.apellido)), ''),
            CASE
              WHEN position('@' in coalesce(u.nombre, '')) > 1
                THEN split_part(u.nombre, '@', 1)
              ELSE u.nombre
            END,
            'Usuario #' || n.id_usuario
          ) AS nombre,
          count(*)::int AS total,
          count(*) FILTER (WHERE n.tipo = 'bitacora')::int AS bitacora,
          count(*) FILTER (WHERE n.tipo = 'checklist')::int AS checklist,
          count(*) FILTER (WHERE n.tipo = 'anotador')::int AS anotador,
          count(*) FILTER (WHERE n.tipo = 'checklist' AND n.hecho)::int AS checklist_hechos,
          coalesce(sum(
            CASE
              WHEN n.hora_inicio IS NOT NULL AND n.hora_fin IS NOT NULL
                THEN extract(epoch FROM (n.hora_fin - n.hora_inicio)) / 60
              ELSE 0
            END
          ), 0)::int AS minutos_registrados
        FROM public.work_pool_operario_notas n
        LEFT JOIN public.usuarios u ON u.id = n.id_usuario
        LEFT JOIN public.legajos_empleados l ON l.id_usuario = n.id_usuario
        WHERE n.created_at >= v_desde
        GROUP BY n.id_usuario, u.nombre, l.nombre, l.apellido
      ) x
    ), '[]'::jsonb),
    'por_dia', coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.fecha)
      FROM (
        SELECT
          to_char(date_trunc('day', n.created_at), 'YYYY-MM-DD') AS fecha,
          count(*)::int AS total,
          count(*) FILTER (WHERE n.tipo = 'bitacora')::int AS bitacora,
          count(*) FILTER (WHERE n.tipo = 'checklist')::int AS checklist
        FROM public.work_pool_operario_notas n
        WHERE n.created_at >= v_desde
        GROUP BY date_trunc('day', n.created_at)
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_operario_nota_crear(
  integer, text, text, text, integer, text, integer, text, integer, text, jsonb, time, time
) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.work_pool_operario_notas_estadisticas(integer, integer) TO authenticated, anon;
