-- Agregar columna para registrar la ubicación física previa al pasar a "Finalizado en Taller".

BEGIN;

ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS ubicacion_final text;

COMMIT;

