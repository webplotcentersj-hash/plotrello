-- Corrige obtener_estadisticas_usuario para que siempre retorne una fila
-- incluso cuando no hay órdenes para el usuario

BEGIN;

CREATE OR REPLACE FUNCTION public.obtener_estadisticas_usuario(
  p_id_usuario integer,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  id_usuario integer,
  nombre_usuario varchar,
  total_ordenes integer,
  ordenes_completadas integer,
  ordenes_en_proceso integer,
  ordenes_pendientes integer,
  movimientos_realizados bigint,
  ultima_actividad timestamptz,
  promedio_dias_completar numeric,
  sector_principal varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nombre_usuario varchar;
  v_total_ordenes integer := 0;
  v_ordenes_completadas integer := 0;
  v_ordenes_en_proceso integer := 0;
  v_ordenes_pendientes integer := 0;
  v_movimientos_realizados bigint := 0;
  v_ultima_actividad timestamptz;
  v_promedio_dias_completar numeric;
  v_sector_principal varchar;
BEGIN
  -- Obtener nombre del usuario
  SELECT nombre INTO v_nombre_usuario
  FROM public.usuarios
  WHERE id = p_id_usuario
  LIMIT 1;

  -- Si el usuario no existe, retornar valores por defecto
  IF v_nombre_usuario IS NULL THEN
    RETURN QUERY SELECT
      p_id_usuario,
      'Usuario Desconocido'::varchar,
      0::integer,
      0::integer,
      0::integer,
      0::integer,
      0::bigint,
      NULL::timestamptz,
      NULL::numeric,
      NULL::varchar;
    RETURN;
  END IF;

  -- Calcular estadísticas de órdenes
  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(
      CASE 
        WHEN o.estado = 'Finalizado en Taller' OR o.estado = 'Almacén de Entrega' THEN 1
        ELSE 0
      END
    ), 0)::integer,
    COALESCE(SUM(
      CASE 
        WHEN o.estado NOT IN ('Diseño Gráfico', 'Finalizado en Taller', 'Almacén de Entrega') THEN 1
        ELSE 0
      END
    ), 0)::integer,
    COALESCE(SUM(
      CASE 
        WHEN o.estado = 'Diseño Gráfico' THEN 1
        ELSE 0
      END
    ), 0)::integer,
    CASE 
      WHEN SUM(
        CASE 
          WHEN o.estado = 'Finalizado en Taller' OR o.estado = 'Almacén de Entrega' THEN 1
          ELSE 0
        END
      ) > 0 THEN
        AVG(
          CASE 
            WHEN o.fecha_entrega IS NOT NULL AND o.fecha_creacion IS NOT NULL THEN
              EXTRACT(EPOCH FROM (o.fecha_entrega - o.fecha_creacion)) / 86400
            ELSE NULL
          END
        )
      ELSE NULL
    END
  INTO
    v_total_ordenes,
    v_ordenes_completadas,
    v_ordenes_en_proceso,
    v_ordenes_pendientes,
    v_promedio_dias_completar
  FROM public.ordenes_trabajo o
  WHERE (
    (p_fecha_desdetene en  IS NULL OR o.fecha_creacion::date >= p_fecha_desde) AND
    (p_fecha_hasta IS NULL OR o.fecha_creacion::date <= p_fecha_hasta)
  )
  AND (
    o.usuario_trabajando_nombre = v_nombre_usuario
    OR o.operario_asignado = v_nombre_usuario
    OR o.nombre_creador = v_nombre_usuario
  );

  -- Calcular movimientos
  SELECT COALESCE(COUNT(*), 0)::bigint
  INTO v_movimientos_realizados
  FROM public.historial_movimientos hm
  WHERE hm.id_usuario = p_id_usuario
    AND (p_fecha_desde IS NULL OR hm.timestamp::date >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR hm.timestamp::date <= p_fecha_hasta);

  -- Obtener última actividad
  SELECT MAX(hm.timestamp)
  INTO v_ultima_actividad
  FROM public.historial_movimientos hm
  WHERE hm.id_usuario = p_id_usuario;

  -- Obtener sector principal
  SELECT sector
  INTO v_sector_principal
  FROM (
    SELECT 
      o.sector,
      COUNT(*) as cantidad
    FROM public.ordenes_trabajo o
    WHERE (
      (p_fecha_desde IS NULL OR o.fecha_creacion::date >= p_fecha_desde) AND
      (p_fecha_hasta IS NULL OR o.fecha_creacion::date <= p_fecha_hasta)
    )
    AND (
      o.usuario_trabajando_nombre = v_nombre_usuario
      OR o.operario_asignado = v_nombre_usuario
      OR o.nombre_creador = v_nombre_usuario
    )
    AND o.sector IS NOT NULL
    GROUP BY o.sector
    ORDER BY cantidad DESC
    LIMIT 1
  ) sector_stats;

  -- Retornar resultado
  RETURN QUERY SELECT
    p_id_usuario,
    v_nombre_usuario,
    COALESCE(v_total_ordenes, 0),
    COALESCE(v_ordenes_completadas, 0),
    COALESCE(v_ordenes_en_proceso, 0),
    COALESCE(v_ordenes_pendientes, 0),
    COALESCE(v_movimientos_realizados, 0),
    v_ultima_actividad,
    v_promedio_dias_completar,
    v_sector_principal;
END;
$$;

COMMIT;

