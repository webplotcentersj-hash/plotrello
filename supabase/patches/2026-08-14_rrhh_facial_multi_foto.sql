-- Múltiples descriptores por empleado (varias fotos de enrolamiento).
-- Antes: PK id_usuario → 1 sola foto. Ahora: N filas por usuario.

ALTER TABLE public.rrhh_facial_descriptores
  DROP CONSTRAINT IF EXISTS rrhh_facial_descriptores_pkey;

ALTER TABLE public.rrhh_facial_descriptores
  ADD COLUMN IF NOT EXISTS id bigserial;

-- id único como PK (si ya existía por un intento previo, no falla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rrhh_facial_descriptores_pkey'
  ) THEN
    ALTER TABLE public.rrhh_facial_descriptores
      ADD CONSTRAINT rrhh_facial_descriptores_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rrhh_facial_descriptores_usuario_foto
  ON public.rrhh_facial_descriptores (id_usuario, foto_key);

CREATE INDEX IF NOT EXISTS idx_rrhh_facial_descriptores_usuario
  ON public.rrhh_facial_descriptores (id_usuario);

-- Fotos extra de enrolamiento (además de la foto de legajo).
CREATE TABLE IF NOT EXISTS public.rrhh_facial_fotos_extra (
  id bigserial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  foto_url text NOT NULL,
  foto_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  CONSTRAINT uq_rrhh_facial_fotos_extra_usuario_key UNIQUE (id_usuario, foto_key)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_facial_fotos_extra_usuario
  ON public.rrhh_facial_fotos_extra (id_usuario);

ALTER TABLE public.rrhh_facial_fotos_extra ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rrhh_facial_fotos_extra FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rrhh_facial_fotos_extra TO service_role;

COMMENT ON TABLE public.rrhh_facial_fotos_extra IS
  'Fotos extra de enrolamiento facial (hasta N por empleado). Se indexan junto a la foto de legajo.';
COMMENT ON TABLE public.rrhh_facial_descriptores IS
  'Descriptores face-api (128 floats); puede haber varias filas por empleado (una por foto).';
