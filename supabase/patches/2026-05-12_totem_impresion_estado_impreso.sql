-- Estado "impreso" para solicitudes del tótem + RPC y listado extendido
BEGIN;

ALTER TABLE public.totem_impresion_solicitudes
  ADD COLUMN IF NOT EXISTS impreso_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS impreso_por_usuario_id integer NULL REFERENCES public.usuarios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_totem_impresion_impreso ON public.totem_impresion_solicitudes (impreso_at);

COMMENT ON COLUMN public.totem_impresion_solicitudes.impreso_at IS 'Cuándo imprenta/mostrador marcó el trabajo como impreso';

DROP FUNCTION IF EXISTS public.listar_solicitudes_impresion_totem (integer, integer);

CREATE OR REPLACE FUNCTION public.listar_solicitudes_impresion_totem (
  p_usuario_id integer,
  p_limite integer DEFAULT 80
)
RETURNS TABLE (
  id bigint,
  cliente_nombre varchar,
  cliente_dni varchar,
  cliente_telefono varchar,
  cantidad_hojas integer,
  tipo_impresion varchar,
  origen_archivo varchar,
  archivo_url text,
  archivo_nombre varchar,
  numero_op varchar,
  estado_pago text,
  created_at timestamptz,
  pagado_at timestamptz,
  id_venta integer,
  numero_venta_crm varchar,
  valor_venta numeric,
  estado_pago_venta varchar,
  impreso_at timestamptz,
  impreso_por_usuario_id integer
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
    s.impreso_por_usuario_id
  FROM public.totem_impresion_solicitudes s
  LEFT JOIN public.ventas v ON v.id = s.id_venta
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(p_limite, 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_impreso_solicitud_impresion_totem (
  p_solicitud_id bigint,
  p_usuario_id integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := false;
  v_n integer := 0;
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
    impreso_at = now(),
    impreso_por_usuario_id = p_usuario_id
  WHERE s.id = p_solicitud_id
    AND s.impreso_at IS NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    v_ok := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.totem_impresion_solicitudes x
    WHERE x.id = p_solicitud_id AND x.impreso_at IS NOT NULL
  ) THEN
    v_ok := true;
  END IF;

  RETURN v_ok;
END;
$$;

COMMENT ON FUNCTION public.marcar_impreso_solicitud_impresion_totem IS 'Marca solicitud tótem como ya impresa (imprenta/mostrador/caja/admin/gerencia/taller-grafico)';

GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem (integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_solicitudes_impresion_totem (integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_impreso_solicitud_impresion_totem (bigint, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.marcar_impreso_solicitud_impresion_totem (bigint, integer) TO authenticated;

COMMIT;
