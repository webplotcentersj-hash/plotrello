-- Ventas del tótem (impresión y catálogo) → Caja Administración, como el resto de cobros PlotLab.

CREATE OR REPLACE FUNCTION public.venta_es_autogestion_totem(p_venta public.ventas)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    coalesce(p_venta.nombre_vendedor, '') ILIKE '%totem%'
    OR coalesce(p_venta.observaciones, '') ILIKE '%tótem%'
    OR coalesce(p_venta.observaciones, '') ILIKE '%totem%'
    OR EXISTS (
      SELECT 1
      FROM public.totem_impresion_solicitudes s
      WHERE s.id_venta = p_venta.id
    );
$$;

CREATE OR REPLACE FUNCTION public.plotlab_caja_slug_venta(p_venta public.ventas)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_venta.caja_slug_cobro IS NOT NULL AND trim(p_venta.caja_slug_cobro) <> '' THEN
    RETURN p_venta.caja_slug_cobro;
  END IF;
  IF public.venta_es_autogestion_totem(p_venta) THEN
    RETURN 'admin';
  END IF;
  RETURN (
    SELECT slug FROM public.control_caja_cajas
    WHERE activa AND slug NOT IN ('admin', 'vuelto')
    ORDER BY slug
    LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_venta_totem_caja_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.caja_slug_cobro IS NULL OR trim(NEW.caja_slug_cobro) = '')
     AND public.venta_es_autogestion_totem(NEW) THEN
    NEW.caja_slug_cobro := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venta_totem_caja_admin ON public.ventas;
CREATE TRIGGER trg_venta_totem_caja_admin
  BEFORE INSERT OR UPDATE OF nombre_vendedor, observaciones, caja_slug_cobro
  ON public.ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_venta_totem_caja_admin();

CREATE OR REPLACE FUNCTION public.trg_totem_solicitud_sync_venta_caja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id_venta IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.ventas v
  SET
    caja_slug_cobro = COALESCE(NULLIF(trim(v.caja_slug_cobro), ''), 'admin'),
    mp_payment_id = COALESCE(v.mp_payment_id, NEW.mp_payment_id),
    monto_pagado = CASE
      WHEN NEW.estado_pago = 'pagado' THEN COALESCE(v.monto_pagado, v.valor_total)
      ELSE v.monto_pagado
    END,
    updated_at = now()
  WHERE v.id = NEW.id_venta;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_totem_solicitud_sync_venta_caja ON public.totem_impresion_solicitudes;
CREATE TRIGGER trg_totem_solicitud_sync_venta_caja
  AFTER INSERT OR UPDATE OF id_venta, estado_pago, mp_payment_id
  ON public.totem_impresion_solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_totem_solicitud_sync_venta_caja();

-- Backfill: ventas tótem ya cobradas → Caja Administración
UPDATE public.ventas v
SET caja_slug_cobro = 'admin'
WHERE (v.caja_slug_cobro IS NULL OR trim(v.caja_slug_cobro) = '')
  AND public.venta_es_autogestion_totem(v);

-- Movimientos PlotLab de esas ventas: destino = admin
UPDATE public.control_caja_movimientos m
SET
  destino_slug = 'admin',
  updated_at = now()
WHERE m.origen_importacion = 'plotlab_venta'
  AND m.anulado = false
  AND EXISTS (
    SELECT 1
    FROM public.ventas v
    WHERE v.caja_slug_cobro = 'admin'
      AND (
        m.observacion LIKE '%PL-VENTA-' || v.id::text || '%'
        OR m.nro_comprobante = v.numero_venta
      )
  );
