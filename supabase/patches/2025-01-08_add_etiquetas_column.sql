-- Añade columna de etiquetas a ordenes_trabajo
ALTER TABLE public.ordenes_trabajo
ADD COLUMN IF NOT EXISTS etiquetas text[] DEFAULT '{}';

