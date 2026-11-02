-- Config del mes (cargas, montos, pct) + pagos parciales de sueldo
ALTER TABLE public.rrhh_liquidacion_periodos
  ADD COLUMN IF NOT EXISTS config_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.rrhh_liquidacion_pagos (
  id bigserial PRIMARY KEY,
  id_periodo bigint NOT NULL REFERENCES public.rrhh_liquidacion_periodos(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  url_recibo text,
  notas text,
  registrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_pagos_periodo
  ON public.rrhh_liquidacion_pagos (id_periodo);
CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_pagos_usuario
  ON public.rrhh_liquidacion_pagos (id_periodo, id_usuario);

ALTER TABLE public.rrhh_liquidacion_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rrhh_liquidacion_pagos_all ON public.rrhh_liquidacion_pagos;
CREATE POLICY rrhh_liquidacion_pagos_all ON public.rrhh_liquidacion_pagos
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.rrhh_liquidacion_pagos TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rrhh_liquidacion_pagos_id_seq TO anon, authenticated, service_role;
