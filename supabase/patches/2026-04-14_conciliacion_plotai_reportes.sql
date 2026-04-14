-- Reportes de conciliación "PlotAI" (extracto vs pagos)
-- Guarda por rango de fechas, estado saldado/incongruencias, resumen e incongruencias.
-- Incluye recomendaciones generadas (texto) para descargar y auditar.

BEGIN;

CREATE TABLE IF NOT EXISTS public.conciliacion_plotai_reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_by_user_name text,

  fecha_desde date NOT NULL,
  fecha_hasta date NOT NULL,
  banco text,
  cuenta_bancaria text,

  estado text NOT NULL CHECK (estado IN ('saldado', 'incongruencias')),
  resumen jsonb NOT NULL DEFAULT '{}'::jsonb,
  incongruencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  recomendaciones_md text
);

CREATE INDEX IF NOT EXISTS idx_conc_plotai_fecha
  ON public.conciliacion_plotai_reportes (fecha_desde, fecha_hasta);

CREATE INDEX IF NOT EXISTS idx_conc_plotai_created_at
  ON public.conciliacion_plotai_reportes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conc_plotai_banco_cuenta
  ON public.conciliacion_plotai_reportes (banco, cuenta_bancaria);

COMMIT;

