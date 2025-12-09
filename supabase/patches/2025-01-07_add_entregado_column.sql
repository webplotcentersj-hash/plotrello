-- Agregar columna para marcar fichas como entregadas/archivadas

BEGIN;

ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS entregado boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ordenes_entregado ON public.ordenes_trabajo(entregado) WHERE entregado = true;

COMMIT;

