-- Fotos subidas desde la app campo (Instalaciones / Metalúrgica): sin Storage, URL inline (data:) en `url`.
-- `es_evidencia_campo` agrupa estas fichas en una sección propia del kanban de etapas.

ALTER TABLE public.enlaces_adjuntos
  ADD COLUMN IF NOT EXISTS es_evidencia_campo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.enlaces_adjuntos.es_evidencia_campo IS 'true si el adjunto se cargó desde la app campo (evidencia en obra); sirve para el listado en kanban Instalaciones/Metalúrgica.';

CREATE INDEX IF NOT EXISTS idx_enlaces_evidencia_campo
  ON public.enlaces_adjuntos (id_orden)
  WHERE es_evidencia_campo = true;
