-- Fusión Kanban (duplicadas multi-sector): la app pone visible_en_tablero = false y sector = NULL
-- para que la fila no entre en ux_ordenes_op_sector (índice parcial WHERE sector IS NOT NULL).
-- Si sector sigue con NOT NULL a nivel de tabla, Postgres devuelve 23502 y la fusión falla.

BEGIN;

ALTER TABLE public.ordenes_trabajo
  ALTER COLUMN sector DROP NOT NULL;

COMMENT ON COLUMN public.ordenes_trabajo.sector IS
  'Columna Kanban por sector. NULL solo en filas ocultas por fusión (visible_en_tablero = false); el listado del tablero las excluye.';

COMMIT;
