-- Eventos de hoja de vida laboral: cambios de puesto, reconocimientos y sanciones formales.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rrhh_eventos_laborales (
  id bigserial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('cambio_puesto', 'reconocimiento', 'sancion')),
  fecha date NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  sector_anterior text,
  sector_nuevo text,
  registrado_por integer REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_eventos_laborales_usuario
  ON public.rrhh_eventos_laborales(id_usuario, fecha DESC);

COMMENT ON TABLE public.rrhh_eventos_laborales IS
  'Eventos formales de la hoja de vida interna (cambio de puesto, reconocimiento, sanción).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rrhh_eventos_laborales TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.rrhh_eventos_laborales_id_seq TO anon, authenticated;

COMMIT;
