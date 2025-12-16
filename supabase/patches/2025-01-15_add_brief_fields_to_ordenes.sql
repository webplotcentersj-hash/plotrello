-- Agregar campos de brief público a las órdenes de trabajo
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS brief_publico text,
  ADD COLUMN IF NOT EXISTS objetivo_proyecto text,
  ADD COLUMN IF NOT EXISTS publico_objetivo text,
  ADD COLUMN IF NOT EXISTS estilo_diseno text,
  ADD COLUMN IF NOT EXISTS referencias text,
  ADD COLUMN IF NOT EXISTS deadline_brief date;

-- Índice para búsqueda por brief
CREATE INDEX IF NOT EXISTS idx_ordenes_brief_publico ON public.ordenes_trabajo(brief_publico) WHERE brief_publico IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN public.ordenes_trabajo.brief_publico IS 'Brief público del proyecto (visible para todos)';
COMMENT ON COLUMN public.ordenes_trabajo.objetivo_proyecto IS 'Objetivo principal del proyecto';
COMMENT ON COLUMN public.ordenes_trabajo.publico_objetivo IS 'Público objetivo del diseño';
COMMENT ON COLUMN public.ordenes_trabajo.estilo_diseno IS 'Estilo de diseño requerido';
COMMENT ON COLUMN public.ordenes_trabajo.referencias IS 'Referencias visuales o enlaces';
COMMENT ON COLUMN public.ordenes_trabajo.deadline_brief IS 'Fecha límite para completar el brief';

