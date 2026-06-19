-- Quitar cliente de cartera CC (incluye rechazados y pendientes)
BEGIN;

CREATE OR REPLACE FUNCTION public.quitar_cliente_cuenta_corriente(p_id_cliente integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id_cliente IS NULL OR p_id_cliente <= 0 THEN
    RAISE EXCEPTION 'id_cliente inválido';
  END IF;

  DELETE FROM public.cc_cuenta_movimientos WHERE id_cliente = p_id_cliente;

  DELETE FROM public.clientes_cuenta_corriente WHERE id_cliente = p_id_cliente;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cliente no está registrado en cuenta corriente';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quitar_cliente_cuenta_corriente(integer) TO anon, authenticated;

COMMIT;
