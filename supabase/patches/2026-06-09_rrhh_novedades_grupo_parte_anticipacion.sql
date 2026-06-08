-- Grupos RRHH: parte diario y anticipación de sueldo.

BEGIN;

ALTER TABLE public.rrhh_novedades DROP CONSTRAINT IF EXISTS rrhh_novedades_grupo_check;

ALTER TABLE public.rrhh_novedades ADD CONSTRAINT rrhh_novedades_grupo_check CHECK (
  grupo = ANY (
    ARRAY[
      'falta'::text,
      'tardanza_retiro'::text,
      'licencia'::text,
      'horas_extra'::text,
      'beneficio_comida'::text,
      'parte_diario'::text,
      'anticipacion_sueldo'::text
    ]
  )
);

COMMENT ON CONSTRAINT rrhh_novedades_grupo_check ON public.rrhh_novedades IS
  'Incluye parte_diario y anticipacion_sueldo además de faltas, tardanzas, licencias, horas extra y beneficio comida.';

COMMIT;
