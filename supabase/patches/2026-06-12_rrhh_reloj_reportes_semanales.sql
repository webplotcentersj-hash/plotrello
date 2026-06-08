-- Reportes semanales del reloj biométrico (snapshot completo para revisión histórica).

BEGIN;

CREATE TABLE IF NOT EXISTS public.rrhh_reloj_reportes_semanales (
  id bigserial PRIMARY KEY,
  periodo_desde date NOT NULL,
  periodo_hasta date NOT NULL,
  archivo_nombre text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  registrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_reloj_reportes_periodo_check CHECK (periodo_hasta >= periodo_desde)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_reloj_reportes_periodo
  ON public.rrhh_reloj_reportes_semanales (periodo_desde, periodo_hasta);

CREATE INDEX IF NOT EXISTS idx_rrhh_reloj_reportes_created
  ON public.rrhh_reloj_reportes_semanales (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rrhh_reloj_reportes_periodo
  ON public.rrhh_reloj_reportes_semanales (periodo_desde, periodo_hasta);

ALTER TABLE public.rrhh_reloj_reportes_semanales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rrhh_reloj_reportes_all ON public.rrhh_reloj_reportes_semanales;
CREATE POLICY rrhh_reloj_reportes_all ON public.rrhh_reloj_reportes_semanales
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.guardar_reloj_reporte_semanal(
  p_periodo_desde date,
  p_periodo_hasta date,
  p_archivo_nombre text,
  p_payload jsonb,
  p_registrado_por integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF p_periodo_desde IS NULL OR p_periodo_hasta IS NULL THEN
    RAISE EXCEPTION 'periodo_desde y periodo_hasta son obligatorios';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload debe ser un objeto JSON';
  END IF;

  INSERT INTO public.rrhh_reloj_reportes_semanales (
    periodo_desde,
    periodo_hasta,
    archivo_nombre,
    payload,
    registrado_por,
    updated_at
  )
  VALUES (
    p_periodo_desde,
    p_periodo_hasta,
    NULLIF(trim(p_archivo_nombre), ''),
    p_payload,
    p_registrado_por,
    now()
  )
  ON CONFLICT (periodo_desde, periodo_hasta) DO UPDATE SET
    archivo_nombre = EXCLUDED.archivo_nombre,
    payload = EXCLUDED.payload,
    registrado_por = EXCLUDED.registrado_por,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guardar_reloj_reporte_semanal(date, date, text, jsonb, integer)
  TO anon, authenticated, service_role;

COMMIT;
