-- Agregar campo etapa_instalaciones para gestionar los pasos dentro de Instalaciones

BEGIN;

ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS etapa_instalaciones varchar(100);

-- Crear índice para búsquedas por etapa
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_etapa_instalaciones 
ON public.ordenes_trabajo(etapa_instalaciones);

-- Comentario para documentación
COMMENT ON COLUMN public.ordenes_trabajo.etapa_instalaciones IS 'Etapa actual dentro de Instalaciones: Falta Info o Material, Coordinados para Instalaciones, Listos para instalar, Pausados, Rehacer';

COMMIT;

