-- Amplía grupo RRHH: pérdida beneficio comida (CHECK en rrhh_novedades.grupo).
-- Ejecutar después de 2026-05-05_rrhh_novedades.sql

BEGIN;

ALTER TABLE public.rrhh_novedades DROP CONSTRAINT IF EXISTS rrhh_novedades_grupo_check;

ALTER TABLE public.rrhh_novedades ADD CONSTRAINT rrhh_novedades_grupo_check CHECK (
  grupo = ANY (
    ARRAY[
      'falta'::text,
      'tardanza_retiro'::text,
      'licencia'::text,
      'horas_extra'::text,
      'beneficio_comida'::text
    ]
  )
);

COMMENT ON CONSTRAINT rrhh_novedades_grupo_check ON public.rrhh_novedades IS
  'Incluye beneficio_comida (ej. pérdida beneficio comida hasta fin de mes).';

COMMIT;
