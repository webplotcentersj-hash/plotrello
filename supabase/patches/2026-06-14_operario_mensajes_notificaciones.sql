-- Mensajería operario externo ↔ cliente (pedido portal), filtro PII y notificaciones bolsa.

BEGIN;

-- ─── Validación anti-PII (teléfono, email, CBU, WhatsApp, etc.) ───────────────
CREATE OR REPLACE FUNCTION public.validar_mensaje_pedido_sin_pii(p_mensaje text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(coalesce(trim(p_mensaje), ''));
  v_digits text;
BEGIN
  IF v = '' THEN
    RAISE EXCEPTION 'El mensaje está vacío';
  END IF;

  IF v ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RAISE EXCEPTION 'No podés incluir direcciones de email en el mensaje';
  END IF;

  IF v ~ '(whatsapp|wsp|wa\.me|api\.whatsapp)' THEN
    RAISE EXCEPTION 'No podés compartir enlaces de WhatsApp';
  END IF;

  IF v ~ '(t\.me/|telegram\.me/)' THEN
    RAISE EXCEPTION 'No podés compartir enlaces de Telegram';
  END IF;

  v_digits := regexp_replace(v, '[^0-9]', '', 'g');
  IF v_digits ~ '\d{22}' THEN
    RAISE EXCEPTION 'No podés incluir CBU, CVU u otros datos bancarios';
  END IF;

  IF v ~ '(\+?54\s?)?(9\s?)?(11|[2-9]\d{2})[\s.-]?\d{3,4}[\s.-]?\d{4}' THEN
    RAISE EXCEPTION 'No podés incluir números de teléfono';
  END IF;

  IF v ~ '\b\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{3,4}\b' THEN
    RAISE EXCEPTION 'No podés incluir números de teléfono';
  END IF;
END;
$$;

-- ─── Helpers notificación operario externo ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_notificar_operario(
  p_id_usuario integer,
  p_titulo text,
  p_descripcion text,
  p_tipo text DEFAULT 'info',
  p_id_pedido integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id_usuario IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_notifications (
    user_id, title, description, type, pedido_id, is_read
  ) VALUES (
    p_id_usuario,
    trim(p_titulo),
    NULLIF(trim(p_descripcion), ''),
    COALESCE(NULLIF(trim(p_tipo), ''), 'info'),
    p_id_pedido,
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_operario_asignado_pedido(
  p_id_pedido integer,
  p_id_usuario integer DEFAULT NULL
)
RETURNS TABLE (
  id_job integer,
  id_usuario_asignado integer,
  numero_pedido text,
  id_cliente integer,
  nombre_operario text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.id_usuario_asignado,
    COALESCE(j.numero_pedido, pc.numero_pedido)::text,
    pc.id_cliente,
    u.nombre::text
  FROM public.work_pool_jobs j
  INNER JOIN public.pedidos_clientes pc ON pc.id = j.id_pedido_cliente
  INNER JOIN public.usuarios u ON u.id = j.id_usuario_asignado
  WHERE j.id_pedido_cliente = p_id_pedido
    AND j.id_pedido_cliente IS NOT NULL
    AND j.id_usuario_asignado IS NOT NULL
    AND j.estado NOT IN ('disponible', 'cancelado')
    AND u.rol IN ('operario-diseno', 'operario-bolsa')
    AND (p_id_usuario IS NULL OR j.id_usuario_asignado = p_id_usuario)
  ORDER BY j.updated_at DESC NULLS LAST, j.id DESC
  LIMIT 1;
END;
$$;

-- ─── Mensajes: operario externo envía ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_mensaje_pedido_operario_externo(
  p_id_pedido integer,
  p_id_usuario integer,
  p_mensaje text
)
RETURNS TABLE (
  id integer,
  id_pedido_cliente integer,
  id_cliente integer,
  id_usuario integer,
  mensaje text,
  es_del_cliente boolean,
  leido boolean,
  fecha_creacion timestamp without time zone,
  nombre_usuario text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_asignacion RECORD;
  v_mensaje_id integer;
BEGIN
  PERFORM public.validar_mensaje_pedido_sin_pii(p_mensaje);

  SELECT * INTO v_asignacion
  FROM public.work_pool_operario_asignado_pedido(p_id_pedido, p_id_usuario);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tenés un trabajo asignado para este pedido';
  END IF;

  INSERT INTO public.mensajes_pedidos_clientes (
    id_pedido_cliente, id_cliente, id_usuario, mensaje, es_del_cliente, leido
  ) VALUES (
    p_id_pedido,
    v_asignacion.id_cliente,
    p_id_usuario,
    trim(p_mensaje),
    false,
    false
  )
  RETURNING mensajes_pedidos_clientes.id INTO v_mensaje_id;

  PERFORM public.crear_notificacion_cliente(
    v_asignacion.id_cliente,
    'mensaje_pedido',
    'Mensaje de ' || COALESCE(v_asignacion.nombre_operario, 'tu operario'),
    'Tenés un mensaje nuevo en el pedido ' || COALESCE(v_asignacion.numero_pedido, '#' || p_id_pedido::text),
    p_id_pedido
  );

  RETURN QUERY
  SELECT
    m.id,
    m.id_pedido_cliente,
    m.id_cliente,
    m.id_usuario,
    m.mensaje,
    m.es_del_cliente,
    m.leido,
    m.fecha_creacion,
    u.nombre::text AS nombre_usuario
  FROM public.mensajes_pedidos_clientes m
  LEFT JOIN public.usuarios u ON u.id = m.id_usuario
  WHERE m.id = v_mensaje_id;
END;
$$;

-- ─── Mensajes: cliente envía (PII + aviso operario) ─────────────────────────
DROP FUNCTION IF EXISTS public.crear_mensaje_pedido_cliente(integer, integer, text, boolean, integer);

CREATE OR REPLACE FUNCTION public.crear_mensaje_pedido_cliente(
  p_id_pedido integer,
  p_id_cliente integer,
  p_mensaje text,
  p_es_del_cliente boolean,
  p_id_usuario integer DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_pedido_cliente integer,
  id_cliente integer,
  id_usuario integer,
  mensaje text,
  es_del_cliente boolean,
  leido boolean,
  fecha_creacion timestamp without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_mensaje_id integer;
  v_asignacion RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_clientes pc
    WHERE pc.id = p_id_pedido AND pc.id_cliente = p_id_cliente
  ) THEN
    RAISE EXCEPTION 'Pedido no encontrado o no pertenece al cliente';
  END IF;

  IF p_es_del_cliente THEN
    PERFORM public.validar_mensaje_pedido_sin_pii(p_mensaje);
  END IF;

  INSERT INTO public.mensajes_pedidos_clientes (
    id_pedido_cliente, id_cliente, id_usuario, mensaje, es_del_cliente, leido
  ) VALUES (
    p_id_pedido,
    p_id_cliente,
    CASE WHEN p_es_del_cliente THEN NULL ELSE p_id_usuario END,
    trim(p_mensaje),
    p_es_del_cliente,
    false
  )
  RETURNING mensajes_pedidos_clientes.id INTO v_mensaje_id;

  IF p_es_del_cliente THEN
    SELECT * INTO v_asignacion
    FROM public.work_pool_operario_asignado_pedido(p_id_pedido, NULL);

    IF FOUND THEN
      PERFORM public.work_pool_notificar_operario(
        v_asignacion.id_usuario_asignado,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.work_pool_jobs j
            WHERE j.id = v_asignacion.id_job AND j.sector = 'diseno'
          ) THEN '[Plot Design] Mensaje del cliente'
          ELSE '[Bolsa Plot] Mensaje del cliente'
        END,
        'Nuevo mensaje en pedido ' || COALESCE(v_asignacion.numero_pedido, '#' || p_id_pedido::text),
        'mention',
        p_id_pedido
      );
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.id_pedido_cliente, m.id_cliente, m.id_usuario,
    m.mensaje, m.es_del_cliente, m.leido, m.fecha_creacion
  FROM public.mensajes_pedidos_clientes m
  WHERE m.id = v_mensaje_id;
END;
$$;

-- ─── Listar pedidos con chat para operario ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.listar_pedidos_chat_operario(p_id_usuario integer)
RETURNS TABLE (
  id_pedido integer,
  numero_pedido text,
  titulo_trabajo text,
  id_job integer,
  mensajes_no_leidos integer,
  ultimo_mensaje_at timestamp without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id AS id_pedido,
    COALESCE(j.numero_pedido, pc.numero_pedido)::text AS numero_pedido,
    j.titulo::text AS titulo_trabajo,
    j.id AS id_job,
    (
      SELECT COUNT(*)::integer
      FROM public.mensajes_pedidos_clientes m
      WHERE m.id_pedido_cliente = pc.id
        AND m.es_del_cliente = true
        AND COALESCE(m.leido, false) = false
    ) AS mensajes_no_leidos,
    (
      SELECT MAX(m.fecha_creacion)
      FROM public.mensajes_pedidos_clientes m
      WHERE m.id_pedido_cliente = pc.id
    ) AS ultimo_mensaje_at
  FROM public.work_pool_jobs j
  INNER JOIN public.pedidos_clientes pc ON pc.id = j.id_pedido_cliente
  WHERE j.id_usuario_asignado = p_id_usuario
    AND j.id_pedido_cliente IS NOT NULL
    AND j.estado NOT IN ('disponible', 'cancelado')
  ORDER BY ultimo_mensaje_at DESC NULLS LAST, j.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_mensajes_pedido_operario(
  p_id_pedido integer,
  p_id_usuario integer
)
RETURNS TABLE (
  id integer,
  id_pedido_cliente integer,
  id_cliente integer,
  id_usuario integer,
  mensaje text,
  es_del_cliente boolean,
  leido boolean,
  fecha_creacion timestamp without time zone,
  nombre_usuario text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.work_pool_operario_asignado_pedido(p_id_pedido, p_id_usuario)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.id_pedido_cliente,
    m.id_cliente,
    m.id_usuario,
    m.mensaje,
    m.es_del_cliente,
    m.leido,
    m.fecha_creacion,
    u.nombre::text AS nombre_usuario
  FROM public.mensajes_pedidos_clientes m
  LEFT JOIN public.usuarios u ON u.id = m.id_usuario
  WHERE m.id_pedido_cliente = p_id_pedido
  ORDER BY m.fecha_creacion ASC, m.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.contar_mensajes_operario_no_leidos(p_id_usuario integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_total
  FROM public.mensajes_pedidos_clientes m
  INNER JOIN public.work_pool_jobs j ON j.id_pedido_cliente = m.id_pedido_cliente
  WHERE j.id_usuario_asignado = p_id_usuario
    AND j.id_pedido_cliente IS NOT NULL
    AND m.es_del_cliente = true
    AND COALESCE(m.leido, false) = false;

  RETURN COALESCE(v_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_mensajes_pedido_leidos_operario(
  p_id_pedido integer,
  p_id_usuario integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizadas integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.work_pool_operario_asignado_pedido(p_id_pedido, p_id_usuario)
  ) THEN
    RAISE EXCEPTION 'No tenés acceso a este pedido';
  END IF;

  UPDATE public.mensajes_pedidos_clientes m
  SET leido = true
  WHERE m.id_pedido_cliente = p_id_pedido
    AND m.es_del_cliente = true
    AND COALESCE(m.leido, false) = false;

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RETURN v_actualizadas;
END;
$$;

-- ─── Notificaciones al asignar / cambios / pago ───────────────────────────────
CREATE OR REPLACE FUNCTION public.work_pool_crear_job(
  p_sector text,
  p_numero_op text DEFAULT NULL,
  p_id_orden integer DEFAULT NULL,
  p_titulo text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_modo text DEFAULT 'bolsa',
  p_monto numeric DEFAULT NULL,
  p_codigo_tarifa text DEFAULT NULL,
  p_id_usuario_creador integer DEFAULT NULL,
  p_id_usuario_asignado integer DEFAULT NULL,
  p_plazo date DEFAULT NULL,
  p_prioridad text DEFAULT 'normal',
  p_id_pedido_cliente integer DEFAULT NULL,
  p_numero_pedido text DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  sector text,
  numero_op varchar,
  estado text,
  monto_presupuestado numeric,
  modo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden_id integer;
  v_numero_op varchar(50);
  v_titulo text;
  v_monto numeric(12, 2);
  v_estado text;
  v_job_id integer;
  v_asignado_rol text;
  v_modo text;
  v_prefijo text;
BEGIN
  IF p_sector NOT IN ('diseno', 'instalaciones', 'metalurgica') THEN
    RAISE EXCEPTION 'sector inválido';
  END IF;
  v_modo := COALESCE(p_modo, 'bolsa');
  IF v_modo NOT IN ('bolsa', 'asignado') THEN
    RAISE EXCEPTION 'modo inválido';
  END IF;

  IF p_id_usuario_asignado IS NOT NULL THEN
    SELECT u.rol INTO v_asignado_rol FROM public.usuarios u WHERE u.id = p_id_usuario_asignado;
    IF v_asignado_rol IN ('operario-diseno', 'operario-bolsa') THEN
      v_modo := 'asignado';
    END IF;
  END IF;

  v_orden_id := p_id_orden;
  IF v_orden_id IS NULL AND NULLIF(trim(p_numero_op), '') IS NOT NULL THEN
    SELECT o.id, o.numero_op::varchar
    INTO v_orden_id, v_numero_op
    FROM public.ordenes_trabajo o
    WHERE o.numero_op::text = trim(p_numero_op)
      AND COALESCE(o.eliminada, false) = false
    ORDER BY o.fecha_creacion DESC NULLS LAST, o.id DESC
    LIMIT 1;
  ELSIF v_orden_id IS NOT NULL THEN
    SELECT o.numero_op::varchar INTO v_numero_op
    FROM public.ordenes_trabajo o WHERE o.id = v_orden_id;
  END IF;

  v_titulo := COALESCE(NULLIF(trim(p_titulo), ''),
    CASE
      WHEN NULLIF(trim(p_numero_pedido), '') IS NOT NULL THEN
        'Pedido ' || trim(p_numero_pedido)
      WHEN p_sector = 'diseno' THEN 'Diseño OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
      WHEN p_sector = 'instalaciones' THEN 'Instalación OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
      ELSE 'Metalúrgica OP ' || COALESCE(v_numero_op, '#' || COALESCE(v_orden_id::text, '?'))
    END);

  v_monto := COALESCE(p_monto, 0);
  IF v_monto <= 0 AND NULLIF(trim(p_codigo_tarifa), '') IS NOT NULL THEN
    SELECT pr.monto_base INTO v_monto
    FROM public.work_pool_pricing_rules pr
    WHERE pr.sector = p_sector AND pr.codigo = trim(p_codigo_tarifa) AND pr.activo = true
    LIMIT 1;
    v_monto := COALESCE(v_monto, 0);
  END IF;

  IF v_modo = 'asignado' AND p_id_usuario_asignado IS NOT NULL THEN
    v_estado := 'asignado';
  ELSE
    v_estado := 'disponible';
  END IF;

  INSERT INTO public.work_pool_jobs (
    sector, id_orden, numero_op, titulo, descripcion, modo, estado, prioridad, plazo,
    monto_presupuestado, codigo_tarifa, id_usuario_creador, id_usuario_asignado,
    id_pedido_cliente, numero_pedido, tomado_at
  ) VALUES (
    p_sector, v_orden_id, v_numero_op, v_titulo, p_descripcion, v_modo, v_estado, COALESCE(p_prioridad, 'normal'),
    p_plazo, v_monto, NULLIF(trim(p_codigo_tarifa), ''), p_id_usuario_creador, p_id_usuario_asignado,
    p_id_pedido_cliente, NULLIF(trim(p_numero_pedido), ''),
    CASE WHEN v_estado IN ('asignado', 'en_curso') THEN now() ELSE NULL END
  )
  RETURNING work_pool_jobs.id INTO v_job_id;

  PERFORM public.work_pool_log_event(v_job_id, 'creado', v_estado, p_id_usuario_creador);

  IF p_id_usuario_asignado IS NOT NULL AND v_asignado_rol IN ('operario-diseno', 'operario-bolsa') THEN
    v_prefijo := CASE WHEN p_sector = 'diseno' THEN '[Plot Design]' ELSE '[Bolsa Plot]' END;
    PERFORM public.work_pool_notificar_operario(
      p_id_usuario_asignado,
      v_prefijo || ' Trabajo asignado',
      'Te asignaron: ' || v_titulo,
      'info',
      p_id_pedido_cliente
    );
  END IF;

  RETURN QUERY
  SELECT j.id, j.sector, j.numero_op, j.estado, j.monto_presupuestado, j.modo
  FROM public.work_pool_jobs j WHERE j.id = v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_solicitar_cambios_job(
  p_id_job integer,
  p_id_usuario integer,
  p_motivo text DEFAULT NULL
)
RETURNS TABLE (id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.work_pool_jobs%ROWTYPE;
  v_prefijo text;
BEGIN
  SELECT * INTO v_job FROM public.work_pool_jobs j WHERE j.id = p_id_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;

  UPDATE public.work_pool_jobs j
  SET estado = 'cambios',
      motivo_rechazo = p_motivo,
      updated_at = now()
  WHERE j.id = p_id_job AND j.estado IN ('entregado', 'en_revision');

  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo solicitar cambios'; END IF;

  PERFORM public.work_pool_log_event(p_id_job, 'cambios', p_motivo, p_id_usuario);

  IF v_job.id_usuario_asignado IS NOT NULL THEN
    v_prefijo := CASE WHEN v_job.sector = 'diseno' THEN '[Plot Design]' ELSE '[Bolsa Plot]' END;
    PERFORM public.work_pool_notificar_operario(
      v_job.id_usuario_asignado,
      v_prefijo || ' Cambios solicitados',
      COALESCE(NULLIF(trim(p_motivo), ''), 'Revisá el trabajo y volvé a entregar.'),
      'warning',
      v_job.id_pedido_cliente
    );
  END IF;

  RETURN QUERY SELECT j.id, j.estado FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_aprobar_job(
  p_id_job integer,
  p_id_usuario_aprobador integer,
  p_monto_final numeric DEFAULT NULL
)
RETURNS TABLE (id integer, estado text, monto_final numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.work_pool_jobs%ROWTYPE;
  v_monto numeric(12, 2);
  v_prefijo text;
BEGIN
  SELECT * INTO v_job FROM public.work_pool_jobs j WHERE j.id = p_id_job FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trabajo no encontrado'; END IF;
  IF v_job.estado NOT IN ('entregado', 'en_revision') THEN
    RAISE EXCEPTION 'Solo se aprueban trabajos entregados (estado: %)', v_job.estado;
  END IF;
  IF v_job.id_usuario_asignado IS NULL THEN
    RAISE EXCEPTION 'El trabajo no tiene operario asignado';
  END IF;

  v_monto := COALESCE(p_monto_final, v_job.monto_final, v_job.monto_presupuestado, 0);
  IF v_monto <= 0 THEN RAISE EXCEPTION 'Monto final inválido'; END IF;

  UPDATE public.work_pool_jobs j
  SET estado = 'aprobado',
      monto_final = v_monto,
      aprobado_at = now(),
      updated_at = now()
  WHERE j.id = p_id_job;

  INSERT INTO public.work_pool_ledger (
    id_usuario, id_job, sector, tipo, monto, estado, notas, registrado_por
  ) VALUES (
    v_job.id_usuario_asignado, p_id_job, v_job.sector, 'acreditacion', v_monto, 'confirmado',
    'Aprobación trabajo #' || p_id_job, p_id_usuario_aprobador
  );

  PERFORM public.work_pool_log_event(p_id_job, 'aprobado', 'Monto: ' || v_monto::text, p_id_usuario_aprobador);

  v_prefijo := CASE WHEN v_job.sector = 'diseno' THEN '[Plot Design]' ELSE '[Bolsa Plot]' END;
  PERFORM public.work_pool_notificar_operario(
    v_job.id_usuario_asignado,
    v_prefijo || ' Trabajo aprobado',
    'Se acreditó $' || trim(to_char(v_monto, 'FM999G999G999')) || ' en tu cuenta.',
    'success',
    v_job.id_pedido_cliente
  );

  RETURN QUERY SELECT j.id, j.estado, j.monto_final FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_mensaje_pedido_sin_pii(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.crear_mensaje_pedido_operario_externo(integer, integer, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.crear_mensaje_pedido_cliente(integer, integer, text, boolean, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.listar_pedidos_chat_operario(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.obtener_mensajes_pedido_operario(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.contar_mensajes_operario_no_leidos(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensajes_pedido_leidos_operario(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.work_pool_operario_asignado_pedido(integer, integer) TO authenticated, anon;

COMMIT;
