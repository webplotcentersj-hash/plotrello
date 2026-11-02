-- Deudas al empleado: meses anteriores, especiales y arrastre automático de saldo impago
CREATE TABLE IF NOT EXISTS public.rrhh_liquidacion_deudas (
  id bigserial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('mes_anterior', 'especial', 'arrastre')),
  concepto text,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  monto_pendiente numeric(14,2) NOT NULL CHECK (monto_pendiente >= 0),
  periodo_origen text,
  periodo_destino text,
  id_periodo_origen bigint REFERENCES public.rrhh_liquidacion_periodos(id) ON DELETE SET NULL,
  activa boolean NOT NULL DEFAULT true,
  registrado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_liq_deudas_usuario
  ON public.rrhh_liquidacion_deudas (id_usuario, activa);
CREATE INDEX IF NOT EXISTS idx_rrhh_liq_deudas_destino
  ON public.rrhh_liquidacion_deudas (periodo_destino, id_usuario);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rrhh_liq_deudas_arrastre
  ON public.rrhh_liquidacion_deudas (id_usuario, periodo_destino)
  WHERE tipo = 'arrastre' AND activa = true;

ALTER TABLE public.rrhh_liquidacion_deudas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rrhh_liquidacion_deudas_all ON public.rrhh_liquidacion_deudas;
CREATE POLICY rrhh_liquidacion_deudas_all ON public.rrhh_liquidacion_deudas
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.rrhh_liquidacion_deudas TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rrhh_liquidacion_deudas_id_seq TO anon, authenticated, service_role;
