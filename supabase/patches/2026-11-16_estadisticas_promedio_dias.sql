-- Estadísticas del período: "Promedio días por orden" daba negativo (ej. -2.597,7).
-- Causa: el AVG incluía TODAS las órdenes del período (no solo las terminadas) y también
-- las que tienen fecha_entrega anterior a fecha_creacion (fechas de prueba o mal cargadas).
-- Arreglo: promediar solo órdenes completadas con entrega >= creación.
-- Misma firma y columnas que 2025-01-19_fix_estadisticas_periodo_fecha.sql.

BEGIN;

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
    -- Solo órdenes terminadas y con fechas coherentes (sin entregas "antes" de crearse).
    AVG(
      CASE
        WHEN completada = 1
         AND fecha_entrega IS NOT NULL
         AND fecha_creacion IS NOT NULL
         AND fecha_entrega >= fecha_creacion::date
        -- fecha_entrega es date: una entrega del mismo día no debe dar días negativos.
        THEN GREATEST(EXTRACT(EPOCH FROM (fecha_entrega - fecha_creacion)) / 86400, 0)
        ELSE NULL
      END
    ) AS promedio_dias_completar,
    CASE
      WHEN dias_periodo > 0 THEN
        COUNT(*)::numeric / dias_periodo::numeric
      ELSE 0
    END AS ordenes_por_dia
  FROM ordenes_periodo;
END;
$$;

COMMIT;
