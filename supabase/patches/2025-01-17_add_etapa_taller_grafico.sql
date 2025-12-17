-- Agregar campo etapa_taller_grafico para gestionar los pasos dentro de Taller Gráfico

BEGIN;

ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS etapa_taller_grafico varchar(100);

-- Crear índice para búsquedas por etapa
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_etapa_taller_grafico 
ON public.ordenes_trabajo(etapa_taller_grafico);

-- Comentario para documentación
COMMENT ON COLUMN public.ordenes_trabajo.etapa_taller_grafico IS 'Etapa actual dentro de Taller Gráfico: Falta Material para Impresión o archivo, En Proceso, Para Cortar o Pegar, Para Rotular, Instalaciones/Ploteo, Metalurgica Instalacion, laminas';

COMMIT;

