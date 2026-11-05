-- Campos laborales / liquidación en legajo (obra social, categoría, puesto, CCT, etc.)
ALTER TABLE public.legajos_empleados
  ADD COLUMN IF NOT EXISTS obra_social text,
  ADD COLUMN IF NOT EXISTS codigo_os text,
  ADD COLUMN IF NOT EXISTS tipo_servicio text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS puesto text,
  ADD COLUMN IF NOT EXISTS retribucion_pactada numeric(14,2),
  ADD COLUMN IF NOT EXISTS modo_liquidacion text,
  ADD COLUMN IF NOT EXISTS modalidad_contrato text,
  ADD COLUMN IF NOT EXISTS convenio_cct text;
