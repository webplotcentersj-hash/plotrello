-- Modo espejo multi-sector: flag compartido por todas las filas con el mismo numero_op.
ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS espejo_sectores_op boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.espejo_sectores_op IS
  'OP multi-sector: replicar datos comunes entre fichas del mismo numero_op al guardar.';
