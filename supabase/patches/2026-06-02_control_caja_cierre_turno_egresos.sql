-- Cierre de turno: lote fondo + administración, egresos con aprobación
BEGIN;

ALTER TABLE public.control_caja_movimientos
  ADD COLUMN IF NOT EXISTS id_lote uuid,
  ADD COLUMN IF NOT EXISTS subtipo_pase text CHECK (subtipo_pase IS NULL OR subtipo_pase IN ('fondo', 'resto_admin', 'libre'));

CREATE TABLE IF NOT EXISTS public.control_caja_transferencia_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  hora time,
  origen_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  caja_fondo_destino_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  arqueo_efectivo numeric(15,2) NOT NULL DEFAULT 0,
  arqueo_otros numeric(15,2) NOT NULL DEFAULT 0,
  fondo_monto numeric(15,2) NOT NULL DEFAULT 0,
  resto_efectivo numeric(15,2) NOT NULL DEFAULT 0,
  resto_otros numeric(15,2) NOT NULL DEFAULT 0,
  egresos_aprobados_ef numeric(15,2) NOT NULL DEFAULT 0,
  id_planilla uuid REFERENCES public.control_caja_planillas(id) ON DELETE SET NULL,
  id_usuario integer,
  usuario_nombre text,
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_caja_lotes_fecha ON public.control_caja_transferencia_lotes(fecha DESC);

ALTER TABLE public.control_caja_movimientos
  DROP CONSTRAINT IF EXISTS control_caja_movimientos_id_lote_fkey;
ALTER TABLE public.control_caja_movimientos
  ADD CONSTRAINT control_caja_movimientos_id_lote_fkey
  FOREIGN KEY (id_lote) REFERENCES public.control_caja_transferencia_lotes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.control_caja_egreso_solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  caja_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  concepto text NOT NULL,
  monto_efectivo numeric(15,2) NOT NULL DEFAULT 0,
  monto_otros numeric(15,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  solicitante_id integer,
  solicitante_nombre text,
  aprobador_id integer,
  aprobador_nombre text,
  observacion text,
  motivo_rechazo text,
  id_movimiento uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_caja_egreso_estado ON public.control_caja_egreso_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_control_caja_egreso_fecha ON public.control_caja_egreso_solicitudes(fecha DESC);

ALTER TABLE public.control_caja_transferencia_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_caja_egreso_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS control_caja_lotes_all ON public.control_caja_transferencia_lotes;
CREATE POLICY control_caja_lotes_all ON public.control_caja_transferencia_lotes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS control_caja_egreso_sol_all ON public.control_caja_egreso_solicitudes;
CREATE POLICY control_caja_egreso_sol_all ON public.control_caja_egreso_solicitudes FOR ALL USING (true) WITH CHECK (true);

COMMIT;
