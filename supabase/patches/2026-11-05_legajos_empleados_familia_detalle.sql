-- Detalle de cónyuge y personas a cargo en legajo
ALTER TABLE public.legajos_empleados
  ADD COLUMN IF NOT EXISTS conyuge_detalle jsonb,
  ADD COLUMN IF NOT EXISTS personas_a_cargo jsonb DEFAULT '[]'::jsonb;
