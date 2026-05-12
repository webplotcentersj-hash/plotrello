-- Permite rol taller-grafico (admin de impresoras) en listar/marcar impreso tótem.
-- Alinear con useAuth.canAccessTotemImpresionPanel.

CREATE OR REPLACE FUNCTION public.listar_solicitudes_impresion_totem (
  p_usuario_id integer,
  p_limite integer DEFAULT 80
)
RETURNS TABLE (
  id bigint,
  cliente_nombre character varying,
  cliente_dni character varying,
  cliente_telefono character varying,
  cantidad_hojas integer,
  tipo_impresion character varying,
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
  impreso_por_usuario_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    s.impreso_por_usuario_id
  FROM public.totem_impresion_solicitudes s
  LEFT JOIN public.ventas v ON v.id = s.id_venta
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(p_limite, 500));
END;
$function$;

CREATE OR REPLACE FUNCTION public.marcar_impreso_solicitud_impresion_totem (p_solicitud_id bigint, p_usuario_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = p_usuario_id
      AND u.rol IN ('imprenta', 'mostrador', 'caja', 'administracion', 'gerencia', 'taller-grafico')
  ) THEN
    RAISE EXCEPTION 'Sin permiso para marcar impreso';
  END IF;

  UPDATE public.totem_impresion_solicitudes s
  SET
    impreso_at = COALESCE(s.impreso_at, now()),
    impreso_por_usuario_id = COALESCE(s.impreso_por_usuario_id, p_usuario_id)
  WHERE s.id = p_solicitud_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
END;
$function$;
