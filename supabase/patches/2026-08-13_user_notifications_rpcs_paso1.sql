-- Paso 1 notificaciones (seguro, reversible):
-- 1) Quitar GRANTs innecesarios (TRUNCATE/REFERENCES/TRIGGER).
-- 2) RPCs SECURITY DEFINER para listar / marcar / crear.
-- NO activa RLS todavía: el cliente usa anon + id entero; las policies
-- actuales con auth.uid() romperían la campanita. Realtime sigue igual.

BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_notifications FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_notifications FROM authenticated;

CREATE OR REPLACE FUNCTION public.listar_notificaciones_usuario(
  p_user_id integer,
  p_limit integer DEFAULT 50,
  p_origen text DEFAULT NULL
)
RETURNS SETOF public.user_notifications
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.*
  FROM public.user_notifications n
  WHERE n.user_id = p_user_id
    AND (p_origen IS NULL OR n.origen = p_origen)
  ORDER BY n."timestamp" DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.marcar_notificacion_leida(
  p_id integer,
  p_user_id integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := false;
BEGIN
  IF p_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_notifications
  SET is_read = true
  WHERE id = p_id
    AND user_id = p_user_id
    AND COALESCE(is_read, false) = false;

  v_ok := FOUND;
  IF NOT v_ok THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_notifications
      WHERE id = p_id AND user_id = p_user_id
    ) INTO v_ok;
  END IF;
  RETURN COALESCE(v_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_todas_notificaciones_leidas(p_user_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.user_notifications
  SET is_read = true
  WHERE user_id = p_user_id
    AND COALESCE(is_read, false) = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_notificacion_usuario(
  p_user_id integer,
  p_title text,
  p_description text DEFAULT NULL,
  p_type text DEFAULT 'info',
  p_origen text DEFAULT 'sistema',
  p_orden_id integer DEFAULT NULL,
  p_pedido_id integer DEFAULT NULL,
  p_solicitud_id integer DEFAULT NULL,
  p_capacitacion_id integer DEFAULT NULL,
  p_oportunidad_id integer DEFAULT NULL,
  p_venta_id integer DEFAULT NULL,
  p_solicitud_chat_id bigint DEFAULT NULL,
  p_reclamo_id bigint DEFAULT NULL,
  p_brief_id integer DEFAULT NULL,
  p_related_id text DEFAULT NULL,
  p_chat_canal text DEFAULT NULL
)
RETURNS public.user_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_notifications;
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'user_id y title son obligatorios';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'usuario inexistente';
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    title,
    description,
    type,
    origen,
    orden_id,
    pedido_id,
    solicitud_id,
    capacitacion_id,
    oportunidad_id,
    venta_id,
    solicitud_chat_id,
    reclamo_id,
    brief_id,
    related_id,
    chat_canal,
    is_read
  )
  VALUES (
    p_user_id,
    left(btrim(p_title), 255),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_type, '')), ''), 'info'),
    COALESCE(NULLIF(btrim(COALESCE(p_origen, '')), ''), 'sistema'),
    p_orden_id,
    p_pedido_id,
    p_solicitud_id,
    p_capacitacion_id,
    p_oportunidad_id,
    p_venta_id,
    p_solicitud_chat_id,
    p_reclamo_id,
    p_brief_id,
    NULLIF(btrim(COALESCE(p_related_id, '')), ''),
    NULLIF(btrim(COALESCE(p_chat_canal, '')), ''),
    false
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_existe_reciente(
  p_type text,
  p_related_id text,
  p_hours integer DEFAULT 24
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_notifications n
    WHERE n.type = p_type
      AND n.related_id = p_related_id
      AND n."timestamp" >= now() - make_interval(hours => GREATEST(COALESCE(p_hours, 24), 1))
    LIMIT 1
  );
$$;

COMMENT ON FUNCTION public.listar_notificaciones_usuario(integer, integer, text) IS
  'Paso 1 seguridad: lista notificaciones de un usuario. Aún no sustituye JWT; evita select * de toda la tabla.';
COMMENT ON FUNCTION public.marcar_notificacion_leida(integer, integer) IS
  'Marca leída solo si id + user_id coinciden.';
COMMENT ON FUNCTION public.marcar_todas_notificaciones_leidas(integer) IS
  'Marca todas las no leídas de un usuario.';
COMMENT ON FUNCTION public.crear_notificacion_usuario IS
  'Inserta notificación vía DEFINER. Triggers internos siguen insertando directo.';
COMMENT ON FUNCTION public.notif_existe_reciente(text, text, integer) IS
  'Dedup de alertas (stock bajo/agotado) sin escanear la tabla desde el cliente.';

GRANT EXECUTE ON FUNCTION public.listar_notificaciones_usuario(integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_notificacion_leida(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_todas_notificaciones_leidas(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_notificacion_usuario(
  integer, text, text, text, text, integer, integer, integer, integer, integer, integer, bigint, bigint, integer, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_existe_reciente(text, text, integer) TO anon, authenticated;

COMMIT;
