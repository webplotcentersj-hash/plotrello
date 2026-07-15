-- Liquidación mensual + ajustes de vacaciones

CREATE TABLE IF NOT EXISTS public.rrhh_liquidacion_periodos (
  id bigserial PRIMARY KEY,
  periodo text NOT NULL,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'cerrado')),
  valor_hora_default numeric(12,2) NOT NULL DEFAULT 0,
  notas text,
  cerrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cerrado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_liquidacion_periodos_periodo_uq UNIQUE (periodo),
  CONSTRAINT rrhh_liquidacion_periodos_periodo_fmt CHECK (periodo ~ '^\d{4}-\d{2}$')
);

CREATE TABLE IF NOT EXISTS public.rrhh_liquidacion_lineas (
  id bigserial PRIMARY KEY,
  id_periodo bigint NOT NULL REFERENCES public.rrhh_liquidacion_periodos(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  dias_trabajados integer NOT NULL DEFAULT 0,
  tardanzas integer NOT NULL DEFAULT 0,
  minutos_tarde integer NOT NULL DEFAULT 0,
  ausencias integer NOT NULL DEFAULT 0,
  he50 numeric(12,2) NOT NULL DEFAULT 0,
  he100 numeric(12,2) NOT NULL DEFAULT 0,
  costo_he numeric(14,2) NOT NULL DEFAULT 0,
  faltas_injustificadas integer NOT NULL DEFAULT 0,
  anticipacion_sueldo numeric(14,2) NOT NULL DEFAULT 0,
  descuento_comida numeric(14,2) NOT NULL DEFAULT 0,
  detalle_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_liquidacion_lineas_periodo_usuario_uq UNIQUE (id_periodo, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_liquidacion_lineas_periodo ON public.rrhh_liquidacion_lineas (id_periodo);

CREATE TABLE IF NOT EXISTS public.rrhh_vacaciones_ajustes (
  id bigserial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  anio integer NOT NULL CHECK (anio >= 2000 AND anio <= 2100),
  dias_ajuste numeric(8,2) NOT NULL,
  motivo text,
  registrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_vacaciones_ajustes_usuario_anio
  ON public.rrhh_vacaciones_ajustes (id_usuario, anio);

ALTER TABLE public.rrhh_liquidacion_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_liquidacion_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_vacaciones_ajustes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rrhh_liquidacion_periodos_all ON public.rrhh_liquidacion_periodos;
CREATE POLICY rrhh_liquidacion_periodos_all ON public.rrhh_liquidacion_periodos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rrhh_liquidacion_lineas_all ON public.rrhh_liquidacion_lineas;
CREATE POLICY rrhh_liquidacion_lineas_all ON public.rrhh_liquidacion_lineas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS rrhh_vacaciones_ajustes_all ON public.rrhh_vacaciones_ajustes;
CREATE POLICY rrhh_vacaciones_ajustes_all ON public.rrhh_vacaciones_ajustes FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.rrhh_liquidacion_periodos TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_liquidacion_lineas TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_vacaciones_ajustes TO anon, authenticated, service_role;
