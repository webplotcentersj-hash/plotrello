-- Corrige funciones de estadísticas para usar hm.timestamp en lugar de hm.fecha_movimiento

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
BEGIN
  RETURN QUERY
  WITH ordenes_usuario AS (
    SELECT 
      o.id,
      o.estado,
      o.fecha_creacion,
      o.fecha_entrega,
      o.sector,
      CASE 
        WHEN o.estado = 'Finalizado en Taller' OR o.estado = 'Almacén de Entrega' THEN 1
        ELSE 0
      END as completada,
      CASE 
        WHEN o.estado NOT IN ('Diseño Gráfico', 'Finalizado en Taller', 'Almacén de Entrega') THEN 1
        ELSE 0
      END as en_proceso,
      CASE 
        WHEN o.estado = 'Diseño Gráfico' THEN 1
        ELSE 0
      END as pendiente
    FROM public.ordenes_trabajo o
    WHERE (
      (p_fecha_desde IS NULL OR o.fecha_creacion::date >= p_fecha_desde) AND
      (p_fecha_hasta IS NULL OR o.fecha_creacion::date <= p_fecha_hasta)
    )
    AND (
      o.usuario_trabajando_nombre = (SELECT nombre FROM public.usuarios WHERE id = p_id_usuario LIMIT 1)
      OR o.operario_asignado = (SELECT nombre FROM public.usuarios WHERE id = p_id_usuario LIMIT 1)
      OR o.nombre_creador = (SELECT nombre FROM public.usuarios WHERE id = p_id_usuario LIMIT 1)
    )
  ),
  movimientos_usuario AS (
    SELECT COUNT(*) as total
    FROM public.historial_movimientos hm
    WHERE hm.id_usuario = p_id_usuario
      AND (p_fecha_desde IS NULL OR hm.timestamp::date >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR hm.timestamp::date <= p_fecha_hasta)
  ),
  ultima_actividad_usuario AS (
    SELECT MAX(hm.timestamp) as ultima_fecha
    FROM public.historial_movimientos hm
    WHERE hm.id_usuario = p_id_usuario
  ),
  sector_principal_usuario AS (
    SELECT sector, COUNT(*) as cantidad
    FROM ordenes_usuario
    WHERE sector IS NOT NULL
    GROUP BY sector
    ORDER BY cantidad DESC
    LIMIT 1
  )
  SELECT
    p_id_usuario AS id_usuario,
    (SELECT nombre FROM public.usuarios WHERE id = p_id_usuario LIMIT 1) AS nombre_usuario,
    COUNT(*)::integer AS total_ordenes,
    SUM(completada)::integer AS ordenes_completadas,
    SUM(en_proceso)::integer AS ordenes_en_proceso,
    SUM(pendiente)::integer AS ordenes_pendientes,
    (SELECT total FROM movimientos_usuario) AS movimientos_realizados,
    (SELECT ultima_fecha FROM ultima_actividad_usuario) AS ultima_actividad,
    CASE 
      WHEN SUM(completada) > 0 THEN
        AVG(
          CASE 
            WHEN fecha_entrega IS NOT NULL AND fecha_creacion IS NOT NULL THEN
              EXTRACT(EPOCH FROM (fecha_entrega - fecha_creacion)) / 86400
            ELSE NULL
          END
        )
      ELSE NULL
    END AS promedio_dias_completar,
    (SELECT sector FROM sector_principal_usuario) AS sector_principal
  FROM ordenes_usuario;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_estadisticas_sector(
  p_sector varchar,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  sector varchar,
  total_ordenes integer,
  ordenes_completadas integer,
  ordenes_en_proceso integer,
  usuarios_activos integer,
  promedio_dias_completar numeric,
  tasa_completitud numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ordenes_sector AS (
    SELECT 
      o.id,
      o.estado,
      o.fecha_creacion,
      o.fecha_entrega,
      CASE 
        WHEN o.estado = 'Finalizado en Taller' OR o.estado = 'Almacén de Entrega' THEN 1
        ELSE 0
      END as completada,
      CASE 
        WHEN o.estado NOT IN ('Diseño Gráfico', 'Finalizado en Taller', 'Almacén de Entrega') THEN 1
        ELSE 0
      END as en_proceso
    FROM public.ordenes_trabajo o
    WHERE o.sector = p_sector
      AND (p_fecha_desde IS NULL OR o.fecha_creacion::date >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR o.fecha_creacion::date <= p_fecha_hasta)
  ),
  usuarios_sector AS (
    SELECT COUNT(DISTINCT o.usuario_trabajando_nombre) as total
    FROM public.ordenes_trabajo o
    WHERE o.sector = p_sector
      AND o.usuario_trabajando_nombre IS NOT NULL
      AND (p_fecha_desde IS NULL OR o.fecha_creacion::date >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL OR o.fecha_creacion::date <= p_fecha_hasta)
  )
  SELECT
    p_sector AS sector,
    COUNT(*)::integer AS total_ordenes,
    SUM(completada)::integer AS ordenes_completadas,
    SUM(en_proceso)::integer AS ordenes_en_proceso,
    (SELECT total FROM usuarios_sector)::integer AS usuarios_activos,
    CASE 
      WHEN SUM(completada) > 0 THEN
        AVG(
          CASE 
            WHEN fecha_entrega IS NOT NULL AND fecha_creacion IS NOT NULL THEN
              EXTRACT(EPOCH FROM (fecha_entrega - fecha_creacion)) / 86400
            ELSE NULL
          END
        )
      ELSE NULL
    END AS promedio_dias_completar,
    CASE 
      WHEN COUNT(*) > 0 THEN
        (SUM(completada)::numeric / COUNT(*)::numeric * 100)
      ELSE 0
    END AS tasa_completitud
  FROM ordenes_sector;
END;
$$;

CREATE OR REPLACE FUNCTION public.obtener_estadisticas_periodo(
  p_fecha_desde date,
  p_fecha_hasta date
)
RETURNS TABLE (
  periodo_inicio date,
  periodo_fin date,
  total_ordenes integer,
  ordenes_completadas integer,
  ordenes_en_proceso integer,
  usuarios_activos integer,
  movimientos_totales bigint,
  promedio_dias_completar numeric,
  ordenes_por_dia numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dias_periodo integer;
BEGIN
  dias_periodo := p_fecha_hasta - p_fecha_desde + 1;
  
  RETURN QUERY
  WITH ordenes_periodo AS (
    SELECT 
      o.id,
      o.estado,
      o.fecha_creacion,
      o.fecha_entrega,
      CASE 
        WHEN o.estado = 'Finalizado en Taller' OR o.estado = 'Almacén de Entrega' THEN 1
        ELSE 0
      END as completada,
      CASE 
        WHEN o.estado NOT IN ('Diseño Gráfico', 'Finalizado en Taller', 'Almacén de Entrega') THEN 1
        ELSE 0
      END as en_proceso
    FROM public.ordenes_trabajo o
    WHERE o.fecha_creacion::date >= p_fecha_desde
      AND o.fecha_creacion::date <= p_fecha_hasta
  ),
  usuarios_periodo AS (
    SELECT COUNT(DISTINCT hm.id_usuario) as total
    FROM public.historial_movimientos hm
    WHERE hm.timestamp::date >= p_fecha_desde
      AND hm.timestamp::date <= p_fecha_hasta
  ),
  movimientos_periodo AS (
    SELECT COUNT(*) as total
    FROM public.historial_movimientos hm
    WHERE hm.timestamp::date >= p_fecha_desde
      AND hm.timestamp::date <= p_fecha_hasta
  )
  SELECT
    p_fecha_desde AS periodo_inicio,
    p_fecha_hasta AS periodo_fin,
    COUNT(*)::integer AS total_ordenes,
    SUM(completada)::integer AS ordenes_completadas,
    SUM(en_proceso)::integer AS ordenes_en_proceso,
    (SELECT total FROM usuarios_periodo)::integer AS usuarios_activos,
    (SELECT total FROM movimientos_periodo) AS movimientos_totales,
    CASE 
      WHEN SUM(completada) > 0 THEN
        AVG(
          CASE 
            WHEN fecha_entrega IS NOT NULL AND fecha_creacion IS NOT NULL THEN
              EXTRACT(EPOCH FROM (fecha_entrega - fecha_creacion)) / 86400
            ELSE NULL
          END
        )
      ELSE NULL
    END AS promedio_dias_completar,
    CASE 
      WHEN dias_periodo > 0 THEN
        COUNT(*)::numeric / dias_periodo::numeric
      ELSE 0
    END AS ordenes_por_dia
  FROM ordenes_periodo;
END;
$$;

COMMIT;


