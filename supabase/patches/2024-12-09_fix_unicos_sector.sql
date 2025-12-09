-- ============================================
-- Garantizar 1 ficha por sector y OP
-- 1) Limpia duplicados dejando la ficha más antigua
-- 2) Crea índice único por numero_op + sector (cuando sector no es NULL)
-- 3) Limpia sub-tareas heredadas de duplicados (precaución)
-- ============================================

BEGIN;

-- 1) Eliminar duplicados por (numero_op, sector), dejando la ficha con menor id
WITH ranked AS (
  SELECT
    id,
    numero_op,
    sector,
    ROW_NUMBER() OVER (PARTITION BY numero_op, sector ORDER BY es_duplicado ASC, id ASC) AS rn
  FROM public.ordenes_trabajo
  WHERE sector IS NOT NULL
)
DELETE FROM public.ordenes_trabajo o
USING ranked r
WHERE o.id = r.id
  AND r.rn > 1;

-- 2) Índice único para prevenir nuevos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS ux_ordenes_op_sector
  ON public.ordenes_trabajo (numero_op, sector)
  WHERE sector IS NOT NULL;

-- 3) Limpiar sub-tareas asociadas a fichas duplicadas (defensa)
DELETE FROM public.tareas t
WHERE t.es_sub_tarea = true
  AND t.id_orden IN (
    SELECT id
    FROM public.ordenes_trabajo
    WHERE sector IS NULL -- fichas inconsistentes
  );

COMMIT;


