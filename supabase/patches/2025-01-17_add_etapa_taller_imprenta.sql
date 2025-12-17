-- Agregar campo etapa_taller_imprenta para gestionar los pasos dentro de Taller de Imprenta

BEGIN;

-- Agregar columna para etapa de Taller de Imprenta
ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS etapa_taller_imprenta varchar(100);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ordenes_etapa_taller_imprenta 
ON public.ordenes_trabajo(etapa_taller_imprenta);

COMMIT;

