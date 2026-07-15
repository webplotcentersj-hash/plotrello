-- Medicina laboral / ART

CREATE TABLE IF NOT EXISTS public.rrhh_medicina_registros (
  id bigserial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('preocupacional', 'periodico', 'egreso', 'accidente', 'otro')),
  fecha date NOT NULL,
  resultado text NOT NULL DEFAULT 'pendiente'
    CHECK (resultado IN ('apto', 'apto_con_restricciones', 'no_apto', 'pendiente')),
  proxima_revision date,
  proveedor text,
  observaciones text,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  registrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_medicina_usuario ON public.rrhh_medicina_registros (id_usuario);
CREATE INDEX IF NOT EXISTS idx_rrhh_medicina_proxima ON public.rrhh_medicina_registros (proxima_revision)
  WHERE proxima_revision IS NOT NULL;

ALTER TABLE public.rrhh_medicina_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rrhh_medicina_registros_all ON public.rrhh_medicina_registros;
CREATE POLICY rrhh_medicina_registros_all ON public.rrhh_medicina_registros FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.rrhh_medicina_registros TO anon, authenticated, service_role;
