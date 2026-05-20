-- Pantalla pública de mostrador: avisos del tótem + cola de impresión (sin login)
BEGIN;

CREATE OR REPLACE FUNCTION public.listar_pantalla_totem_publica(
  p_horas integer DEFAULT 48,
  p_limite_visitas integer DEFAULT 30,
  p_limite_impresiones integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_horas integer := greatest(1, least(coalesce(p_horas, 48), 168));
  v_lim_v integer := greatest(1, least(coalesce(p_limite_visitas, 30), 80));
  v_lim_i integer := greatest(1, least(coalesce(p_limite_impresiones, 30), 80));
  v_desde timestamptz := now() - make_interval(hours => v_horas);
  v_visitas jsonb;
  v_impresiones jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.fecha_atencion DESC), '[]'::jsonb)
  INTO v_visitas
  FROM (
    SELECT
      a.id,
      a.cliente_nombre,
      a.notas,
      a.fecha_atencion,
      a.tipo
    FROM public.atenciones_mostrador a
    WHERE a.fecha_atencion >= v_desde
      AND (
        lower(coalesce(a.usuario_nombre, '')) LIKE '%totem%'
        OR coalesce(a.notas, '') ILIKE '%tótem%'
        OR coalesce(a.notas, '') ILIKE '%totem%'
      )
    ORDER BY a.fecha_atencion DESC
    LIMIT v_lim_v
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_impresiones
  FROM (
    SELECT
      s.id,
      s.cliente_nombre,
      s.cantidad_hojas,
      s.tipo_impresion,
      s.estado_pago,
      s.numero_op,
      s.created_at,
      s.impreso_at
    FROM public.totem_impresion_solicitudes s
    WHERE s.created_at >= v_desde
      AND s.impreso_at IS NULL
    ORDER BY s.created_at DESC
    LIMIT v_lim_i
  ) t;

  RETURN jsonb_build_object(
    'visitas', coalesce(v_visitas, '[]'::jsonb),
    'impresiones', coalesce(v_impresiones, '[]'::jsonb),
    'generado_en', to_jsonb(now())
  );
END;
$$;

COMMENT ON FUNCTION public.listar_pantalla_totem_publica IS
  'Pantalla TV mostrador: visitas desde tótem e impresiones pendientes (últimas N horas).';

GRANT EXECUTE ON FUNCTION public.listar_pantalla_totem_publica(integer, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.listar_pantalla_totem_publica(integer, integer, integer) TO authenticated;

COMMIT;
