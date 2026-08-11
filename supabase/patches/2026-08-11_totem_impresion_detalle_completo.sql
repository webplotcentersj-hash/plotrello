-- Snapshot completo del pedido tótem (formato, papel, faz, color, notas, etc.)
-- Aplicado en Supabase como migration: totem_impresion_detalle_completo

ALTER TABLE public.totem_impresion_solicitudes
  ALTER COLUMN tipo_impresion TYPE text;

ALTER TABLE public.totem_impresion_solicitudes
  ADD COLUMN IF NOT EXISTS detalle jsonb;

COMMENT ON COLUMN public.totem_impresion_solicitudes.detalle IS
  'Snapshot del pedido: formato, papel, faz, modo color, páginas color/B/N, notas, archivos, etc.';

CREATE OR REPLACE FUNCTION public.sync_totem_solicitud_detalle_from_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.solicitud_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.solicitud_id IS NOT DISTINCT FROM NEW.solicitud_id
     AND OLD.payload IS NOT DISTINCT FROM NEW.payload THEN
    RETURN NEW;
  END IF;

  UPDATE public.totem_impresion_solicitudes s
  SET detalle = coalesce(NEW.payload, '{}'::jsonb)
  WHERE s.id = NEW.solicitud_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_totem_solicitud_detalle ON public.totem_impresion_checkouts;
CREATE TRIGGER trg_sync_totem_solicitud_detalle
AFTER INSERT OR UPDATE OF solicitud_id, payload
ON public.totem_impresion_checkouts
FOR EACH ROW
EXECUTE FUNCTION public.sync_totem_solicitud_detalle_from_checkout();

DROP FUNCTION IF EXISTS public.listar_solicitudes_impresion_totem(integer, integer);

CREATE OR REPLACE FUNCTION public.listar_solicitudes_impresion_totem(
  p_usuario_id integer,
  p_limite integer DEFAULT 80
)
RETURNS TABLE (
  id bigint,
  cliente_nombre character varying,
  cliente_dni character varying,
  cliente_telefono character varying,
  cantidad_hojas integer,
  tipo_impresion text,
  origen_archivo character varying,
  archivo_url text,
  archivo_nombre character varying,
  numero_op character varying,
  estado_pago text,
  created_at timestamp with time zone,
  pagado_at timestamp with time zone,
  id_venta integer,
  numero_venta_crm character varying,
  valor_venta numeric,
  estado_pago_venta character varying,
  impreso_at timestamp with time zone,
  impreso_por_usuario_id integer,
  mp_payment_id character varying,
  mp_preference_id character varying,
  detalle jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('imprenta', 'mostrador', 'caja', 'administracion', 'gerencia', 'taller-grafico')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para listar solicitudes de impresión del tótem';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.cliente_nombre,
    s.cliente_dni,
    s.cliente_telefono,
    s.cantidad_hojas,
    s.tipo_impresion,
    s.origen_archivo,
    s.archivo_url,
    s.archivo_nombre,
    s.numero_op,
    s.estado_pago,
    s.created_at,
    s.pagado_at,
    s.id_venta,
    v.numero_venta,
    v.valor_total,
    v.estado_pago,
    s.impreso_at,
    s.impreso_por_usuario_id,
    s.mp_payment_id,
    s.mp_preference_id,
    s.detalle
  FROM public.totem_impresion_solicitudes s
  LEFT JOIN public.ventas v ON v.id = s.id_venta
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(p_limite, 500));
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem(integer, integer) TO authenticated;

UPDATE public.totem_impresion_solicitudes s
SET detalle = c.payload
FROM public.totem_impresion_checkouts c
WHERE c.solicitud_id = s.id
  AND s.detalle IS NULL
  AND c.payload IS NOT NULL;
