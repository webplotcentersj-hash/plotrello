-- Índice facial precomputado (face-api) para kiosco tablet.
-- Se regenera desde el panel RRHH; el kiosco solo lo descarga.

CREATE TABLE IF NOT EXISTS public.rrhh_facial_descriptores (
  id_usuario integer PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  foto_url text NOT NULL,
  foto_key text NOT NULL,
  descriptor jsonb NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_facial_descriptores_descriptor_array
    CHECK (jsonb_typeof(descriptor) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_rrhh_facial_descriptores_foto_key
  ON public.rrhh_facial_descriptores (foto_key);

CREATE TABLE IF NOT EXISTS public.rrhh_facial_indice_meta (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signature text NOT NULL DEFAULT '',
  indexed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  total_fotos integer NOT NULL DEFAULT 0,
  built_at timestamptz,
  built_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL
);

INSERT INTO public.rrhh_facial_indice_meta (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rrhh_facial_descriptores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_facial_indice_meta ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rrhh_facial_descriptores FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.rrhh_facial_indice_meta FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rrhh_facial_descriptores TO service_role;
GRANT ALL ON public.rrhh_facial_indice_meta TO service_role;

COMMENT ON TABLE public.rrhh_facial_descriptores IS
  'Descriptores face-api (128 floats) por empleado; indexados desde panel RRHH.';
COMMENT ON TABLE public.rrhh_facial_indice_meta IS
  'Metadatos del último índice facial (fila única id=1).';
