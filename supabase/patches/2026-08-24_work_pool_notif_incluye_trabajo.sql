-- Notificaciones de cambios/aprobación incluyen nombre del trabajo (+ OP si hay)
CREATE OR REPLACE FUNCTION public.work_pool_job_label_notif(p_titulo text, p_numero_op text, p_id_job integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN nullif(trim(coalesce(p_titulo, '')), '') IS NOT NULL
      AND nullif(trim(coalesce(p_numero_op, '')), '') IS NOT NULL
      AND position(upper(trim(p_numero_op)) in upper(p_titulo)) = 0
      THEN trim(p_titulo) || ' · OP ' || trim(p_numero_op)
    WHEN nullif(trim(coalesce(p_titulo, '')), '') IS NOT NULL
      THEN trim(p_titulo)
    WHEN nullif(trim(coalesce(p_numero_op, '')), '') IS NOT NULL
      THEN 'OP ' || trim(p_numero_op)
    ELSE 'Trabajo #' || coalesce(p_id_job, 0)::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.work_pool_notificar_operario(
  p_id_usuario integer,
  p_titulo text,
  p_descripcion text,
  p_tipo text DEFAULT 'info',
  p_id_pedido integer DEFAULT NULL,
  p_orden_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id_usuario IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_notifications (
    user_id, title, description, type, pedido_id, orden_id, is_read
  ) VALUES (
    p_id_usuario,
    trim(p_titulo),
    NULLIF(trim(p_descripcion), ''),
    COALESCE(NULLIF(trim(p_tipo), ''), 'info'),
    p_id_pedido,
    p_orden_id,
    false
  );
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
  v_label text;
  v_motivo text;
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
    v_label := public.work_pool_job_label_notif(v_job.titulo, v_job.numero_op, v_job.id);
    v_motivo := COALESCE(NULLIF(trim(p_motivo), ''), 'Revisá el trabajo y volvé a entregar.');
    PERFORM public.work_pool_notificar_operario(
      v_job.id_usuario_asignado,
      v_prefijo || ' Cambios · ' || left(v_label, 80),
      'Trabajo: ' || v_label || E'\n' || v_motivo,
      'warning',
      v_job.id_pedido_cliente,
      v_job.id_orden
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
  v_label text;
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
  v_label := public.work_pool_job_label_notif(v_job.titulo, v_job.numero_op, v_job.id);
  PERFORM public.work_pool_notificar_operario(
    v_job.id_usuario_asignado,
    v_prefijo || ' Aprobado · ' || left(v_label, 80),
    'Trabajo: ' || v_label || E'\nSe acreditó $' || trim(to_char(v_monto, 'FM999G999G999')) || ' en tu cuenta.',
    'success',
    v_job.id_pedido_cliente,
    v_job.id_orden
  );

  RETURN QUERY SELECT j.id, j.estado, j.monto_final FROM public.work_pool_jobs j WHERE j.id = p_id_job;
END;
$$;
