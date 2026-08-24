-- Detalle completo de un job de bolsa para operario externo (brief OP + adjuntos + archivos portal)
CREATE OR REPLACE FUNCTION public.work_pool_job_detalle_operario(
  p_id_job integer,
  p_id_usuario integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.work_pool_jobs%ROWTYPE;
  v_rol text;
  v_orden jsonb := NULL;
  v_adjuntos jsonb := '[]'::jsonb;
  v_pedido_archivos jsonb := '[]'::jsonb;
  v_id_pedido integer;
  v_ok boolean := false;
BEGIN
  IF p_id_job IS NULL OR p_id_usuario IS NULL THEN
    RAISE EXCEPTION 'Parámetros inválidos';
  END IF;

  SELECT * INTO v_job FROM public.work_pool_jobs j WHERE j.id = p_id_job;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trabajo no encontrado';
  END IF;

  SELECT u.rol INTO v_rol FROM public.usuarios u WHERE u.id = p_id_usuario;

  IF v_job.estado = 'disponible' THEN
    v_ok := true;
  ELSIF v_job.id_usuario_asignado = p_id_usuario THEN
    v_ok := true;
  ELSIF coalesce(v_rol, '') IN (
    'admin', 'administrador', 'gerencia', 'supervisor',
    'diseno', 'diseño', 'plot-design', 'bolsa-plot'
  ) THEN
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'No tenés acceso a este trabajo';
  END IF;

  IF v_job.id_orden IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', o.id,
      'numero_op', o.numero_op,
      'cliente', o.cliente,
      'cliente_empresa', o.cliente_empresa,
      'cliente_nombre_completo', o.cliente_nombre_completo,
      'sector', o.sector,
      'descripcion', o.descripcion,
      'brief_publico', o.brief_publico,
      'objetivo_proyecto', o.objetivo_proyecto,
      'publico_objetivo', o.publico_objetivo,
      'etiquetas', o.etiquetas,
      'foto_url', o.foto_url,
      'fecha_limite_brief', o.fecha_limite_brief,
      'deadline_brief', o.deadline_brief,
      'id_pedido_cliente', o.id_pedido_cliente,
      'brief_token', o.brief_token
    )
    INTO v_orden
    FROM public.ordenes_trabajo o
    WHERE o.id = v_job.id_orden;

    SELECT coalesce(jsonb_agg(x.obj ORDER BY x.ord DESC), '[]'::jsonb)
    INTO v_adjuntos
    FROM (
      SELECT
        e.creado_en AS ord,
        jsonb_build_object(
          'id', e.id,
          'titulo', e.titulo,
          'url', e.url,
          'creado_en', e.creado_en,
          'es_evidencia_campo', e.es_evidencia_campo
        ) AS obj
      FROM public.enlaces_adjuntos e
      WHERE e.id_orden = v_job.id_orden
        AND e.url IS NOT NULL
        AND trim(e.url) <> ''
    ) x;
  END IF;

  v_id_pedido := coalesce(
    v_job.id_pedido_cliente,
    CASE WHEN v_orden IS NOT NULL THEN NULLIF(v_orden->>'id_pedido_cliente', '')::integer ELSE NULL END
  );

  IF v_id_pedido IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(x.obj ORDER BY x.ord DESC), '[]'::jsonb)
    INTO v_pedido_archivos
    FROM (
      SELECT
        a.uploaded_at AS ord,
        jsonb_build_object(
          'id', a.id,
          'nombre_archivo', a.nombre_archivo,
          'url', a.url,
          'tipo', a.tipo,
          'uploaded_at', a.uploaded_at
        ) AS obj
      FROM public.pedidos_clientes_archivos a
      WHERE a.id_pedido = v_id_pedido
        AND a.url IS NOT NULL
        AND trim(a.url) <> ''
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'job', jsonb_build_object(
      'id', v_job.id,
      'titulo', v_job.titulo,
      'descripcion', v_job.descripcion,
      'sector', v_job.sector,
      'estado', v_job.estado,
      'modo', v_job.modo,
      'prioridad', v_job.prioridad,
      'plazo', v_job.plazo,
      'monto_presupuestado', v_job.monto_presupuestado,
      'monto_final', v_job.monto_final,
      'numero_op', v_job.numero_op,
      'numero_pedido', v_job.numero_pedido,
      'id_orden', v_job.id_orden,
      'id_pedido_cliente', v_job.id_pedido_cliente,
      'metadata', v_job.metadata,
      'notas_entrega', v_job.notas_entrega,
      'motivo_rechazo', v_job.motivo_rechazo,
      'entregado_at', v_job.entregado_at,
      'tomado_at', v_job.tomado_at,
      'aprobado_at', v_job.aprobado_at,
      'created_at', v_job.created_at
    ),
    'orden', v_orden,
    'adjuntos', coalesce(v_adjuntos, '[]'::jsonb),
    'pedido_archivos', coalesce(v_pedido_archivos, '[]'::jsonb),
    'entrega_drive_url', nullif(trim(coalesce(v_job.metadata->>'entrega_drive_url', '')), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_pool_job_detalle_operario(integer, integer) TO authenticated, anon;

COMMENT ON FUNCTION public.work_pool_job_detalle_operario(integer, integer) IS
  'Detalle de trabajo para panel operario: brief OP (sin contacto cliente), adjuntos y archivos del portal.';
