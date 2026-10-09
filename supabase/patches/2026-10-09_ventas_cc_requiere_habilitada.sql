-- No se puede crear ni pasar una venta a Cuenta Corriente si el cliente no está habilitado.

CREATE OR REPLACE FUNCTION public.ventas_bloquear_cc_sin_habilitar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.metodo_pago IS NULL OR NEW.metodo_pago !~* 'cuenta[[:space:]]*corriente' THEN
    RETURN NEW;
  END IF;
  IF NEW.id_cliente IS NULL OR NOT public.cliente_habilitado_cuenta_corriente(NEW.id_cliente) THEN
    RAISE EXCEPTION 'Este cliente no está habilitado para cuenta corriente. Hay que darlo de alta y aprobarlo antes de vender a cuenta.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_cc_habilitada ON public.ventas;
CREATE TRIGGER trg_ventas_cc_habilitada
  BEFORE INSERT OR UPDATE OF metodo_pago, id_cliente
  ON public.ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.ventas_bloquear_cc_sin_habilitar();
