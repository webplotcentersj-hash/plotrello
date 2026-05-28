-- Contador y marcar leídas para badge del portal cliente.

CREATE OR REPLACE FUNCTION public.contar_notificaciones_cliente_no_leidas(
  p_id_cliente integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_total
  FROM public.clientes_notificaciones n
  WHERE n.id_cliente = p_id_cliente
    AND COALESCE(n.leida, false) = false;
  RETURN COALESCE(v_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_notificaciones_cliente_leidas(
  p_id_cliente integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizadas integer;
BEGIN
  UPDATE public.clientes_notificaciones n
  SET leida = true
  WHERE n.id_cliente = p_id_cliente
    AND COALESCE(n.leida, false) = false;

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RETURN v_actualizadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contar_notificaciones_cliente_no_leidas(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.marcar_notificaciones_cliente_leidas(integer) TO authenticated, anon;
