-- Agregar campo etapa_metalurgica para gestionar los pasos dentro de Metalúrgica

BEGIN;

-- Agregar columna para etapa de Metalúrgica
ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS etapa_metalurgica varchar(100);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ordenes_etapa_metalurgica 
ON public.ordenes_trabajo(etapa_metalurgica);

COMMIT;

