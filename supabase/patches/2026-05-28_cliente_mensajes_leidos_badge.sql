-- Mensajes pedido cliente: lectura, contadores y obtener con nombre de staff.

DROP FUNCTION IF EXISTS public.obtener_mensajes_pedido(integer, integer);

CREATE OR REPLACE FUNCTION public.obtener_mensajes_pedido(
  p_id_pedido_cliente integer,
  p_id_cliente integer
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
    SELECT 1 FROM public.pedidos_clientes pc
    WHERE pc.id = p_id_pedido_cliente AND pc.id_cliente = p_id_cliente
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
  WHERE m.id_pedido_cliente = p_id_pedido_cliente
    AND m.id_cliente = p_id_cliente
  ORDER BY m.fecha_creacion ASC, m.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.contar_mensajes_cliente_no_leidos(
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
  FROM public.mensajes_pedidos_clientes m
  INNER JOIN public.pedidos_clientes pc ON pc.id = m.id_pedido_cliente
  WHERE pc.id_cliente = p_id_cliente
    AND m.es_del_cliente = false
    AND COALESCE(m.leido, false) = false;

  RETURN COALESCE(v_total, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_mensajes_pedido_no_leidos_cliente(
  p_id_cliente integer
)
RETURNS TABLE (
  id_pedido integer,
  cantidad integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id_pedido_cliente AS id_pedido,
    COUNT(*)::integer AS cantidad
  FROM public.mensajes_pedidos_clientes m
  INNER JOIN public.pedidos_clientes pc ON pc.id = m.id_pedido_cliente
  WHERE pc.id_cliente = p_id_cliente
    AND m.es_del_cliente = false
    AND COALESCE(m.leido, false) = false
  GROUP BY m.id_pedido_cliente
  ORDER BY m.id_pedido_cliente;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_mensajes_pedido_leidos_cliente(
  p_id_pedido integer,
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
  IF NOT EXISTS (
    SELECT 1 FROM public.pedidos_clientes pc
    WHERE pc.id = p_id_pedido AND pc.id_cliente = p_id_cliente
  ) THEN
    RAISE EXCEPTION 'Pedido no encontrado o no pertenece al cliente';
  END IF;

  UPDATE public.mensajes_pedidos_clientes m
  SET leido = true
  WHERE m.id_pedido_cliente = p_id_pedido
    AND m.id_cliente = p_id_cliente
    AND m.es_del_cliente = false
    AND COALESCE(m.leido, false) = false;

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RETURN v_actualizadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_mensajes_pedido(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.contar_mensajes_cliente_no_leidos(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.listar_mensajes_pedido_no_leidos_cliente(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensajes_pedido_leidos_cliente(integer, integer) TO authenticated, anon;
