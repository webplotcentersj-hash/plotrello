-- Encuestas de clima laboral

CREATE TABLE IF NOT EXISTS public.rrhh_clima_encuestas (
  id bigserial PRIMARY KEY,
  titulo text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'activa', 'cerrada')),
  anonima boolean NOT NULL DEFAULT true,
  fecha_cierre date,
  created_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rrhh_clima_preguntas (
  id bigserial PRIMARY KEY,
  id_encuesta bigint NOT NULL REFERENCES public.rrhh_clima_encuestas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  tipo text NOT NULL DEFAULT 'likert_1_5'
    CHECK (tipo IN ('likert_1_5', 'texto', 'enps')),
  orden integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rrhh_clima_preguntas_encuesta
  ON public.rrhh_clima_preguntas (id_encuesta, orden);

CREATE TABLE IF NOT EXISTS public.rrhh_clima_respuestas (
  id bigserial PRIMARY KEY,
  id_encuesta bigint NOT NULL REFERENCES public.rrhh_clima_encuestas(id) ON DELETE CASCADE,
  id_pregunta bigint NOT NULL REFERENCES public.rrhh_clima_preguntas(id) ON DELETE CASCADE,
  valor_num numeric(8,2),
  valor_texto text,
  token_anon text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_clima_respuestas_token_pregunta_uq UNIQUE (id_pregunta, token_anon)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_clima_respuestas_encuesta
  ON public.rrhh_clima_respuestas (id_encuesta);

ALTER TABLE public.rrhh_clima_encuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_clima_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_clima_respuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rrhh_clima_encuestas_all ON public.rrhh_clima_encuestas;
CREATE POLICY rrhh_clima_encuestas_all ON public.rrhh_clima_encuestas FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rrhh_clima_preguntas_all ON public.rrhh_clima_preguntas;
CREATE POLICY rrhh_clima_preguntas_all ON public.rrhh_clima_preguntas FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rrhh_clima_respuestas_all ON public.rrhh_clima_respuestas;
CREATE POLICY rrhh_clima_respuestas_all ON public.rrhh_clima_respuestas FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.rrhh_clima_encuestas TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_clima_preguntas TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_clima_respuestas TO anon, authenticated, service_role;
