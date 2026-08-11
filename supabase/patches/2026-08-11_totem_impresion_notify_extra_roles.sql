-- Notificar también a taller-grafico / admin / gerencia (tienen panel pero antes no recibían campana).
CREATE OR REPLACE FUNCTION public.trg_totem_impresion_notify_extra ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_titulo text;
  v_desc text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (
      coalesce(OLD.estado_pago, '') IS DISTINCT FROM 'pagado'
      AND NEW.estado_pago = 'pagado'
    ) THEN
      RETURN NEW;
    END IF;
    v_titulo := 'Tótem: pago confirmado — impresión';
  ELSE
    IF NEW.estado_pago = 'pagado' THEN
      v_titulo := 'Tótem: impresión pagada (Mercado Pago)';
    ELSE
      v_titulo := 'Tótem: nueva solicitud de impresión';
    END IF;
  END IF;

  v_desc :=
    'Solicitud #' || NEW.id::text || ' — Cliente: ' || coalesce(NEW.cliente_nombre, '') || E'\n' ||
    'Archivo: ' || coalesce(NEW.archivo_nombre, '') || E'\n' ||
    'Descargar: ' || coalesce(NEW.archivo_url, '') || E'\n' ||
    CASE
      WHEN NEW.estado_pago = 'pagado' THEN 'Pago confirmado. Podés imprimir.'
      ELSE 'Pendiente de cobro.'
    END;

  FOR v_user IN
    SELECT id
    FROM public.usuarios
    WHERE rol IN ('taller-grafico', 'administracion', 'gerencia')
  LOOP
    INSERT INTO public.user_notifications (
      user_id, title, description, type, is_read, orden_id
    ) VALUES (
      v_user.id, v_titulo, v_desc, 'success', false, NULL
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_totem_impresion_notify_extra ON public.totem_impresion_solicitudes;

CREATE TRIGGER trg_totem_impresion_notify_extra
AFTER INSERT OR UPDATE OF estado_pago ON public.totem_impresion_solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.trg_totem_impresion_notify_extra ();

COMMENT ON FUNCTION public.trg_totem_impresion_notify_extra IS
  'Campana extra para roles con acceso al panel de impresión tótem (además de imprenta/mostrador/caja).';
