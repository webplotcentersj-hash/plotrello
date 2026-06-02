-- Modelo planilla Plot Center: medios de pago por columna, traspasos, cierres con snapshot
BEGIN;

-- Movimientos: desglose completo por medio de pago
ALTER TABLE public.control_caja_movimientos
  ADD COLUMN IF NOT EXISTS tipo_movimiento text DEFAULT 'egreso'
    CHECK (tipo_movimiento IS NULL OR tipo_movimiento IN ('ingreso', 'egreso', 'traspaso', 'ajuste')),
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS tercero_nombre text,
  ADD COLUMN IF NOT EXISTS monto_total numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cuenta_corriente numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cheque_propio numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cheque_tercero numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarjeta numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documento numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cuenta_contable numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transferencia_bancaria numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cierre_id uuid,
  ADD COLUMN IF NOT EXISTS anulado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_control_caja_mov_caja_fecha
  ON public.control_caja_movimientos(origen_slug, fecha);
CREATE INDEX IF NOT EXISTS idx_control_caja_mov_cierre
  ON public.control_caja_movimientos(cierre_id);
CREATE INDEX IF NOT EXISTS idx_control_caja_mov_traspaso
  ON public.control_caja_movimientos(traspaso_id);

-- Traspasos entre cajas (confirmación)
CREATE TABLE IF NOT EXISTS public.control_caja_traspasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  caja_origen_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  caja_destino_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  id_usuario integer,
  usuario_nombre text,
  comprobante text,
  monto_total numeric(15,2) NOT NULL DEFAULT 0,
  efectivo numeric(15,2) NOT NULL DEFAULT 0,
  tarjeta numeric(15,2) NOT NULL DEFAULT 0,
  transferencia_bancaria numeric(15,2) NOT NULL DEFAULT 0,
  cheque numeric(15,2) NOT NULL DEFAULT 0,
  documento numeric(15,2) NOT NULL DEFAULT 0,
  otros numeric(15,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmado', 'anulado')),
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT control_caja_traspasos_cajas_distintas CHECK (caja_origen_slug <> caja_destino_slug)
);

-- Cierres: estado y snapshot de totales
ALTER TABLE public.control_caja_cierres
  ADD COLUMN IF NOT EXISTS estado_cierre text NOT NULL DEFAULT 'abierto'
    CHECK (estado_cierre IN ('abierto', 'cerrado', 'observado', 'anulado')),
  ADD COLUMN IF NOT EXISTS fecha_hasta date,
  ADD COLUMN IF NOT EXISTS snapshot_totales jsonb,
  ADD COLUMN IF NOT EXISTS id_usuario integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Arqueo: saldos por medio (teórico vs contado)
ALTER TABLE public.control_caja_arqueos
  ADD COLUMN IF NOT EXISTS saldos jsonb,
  ADD COLUMN IF NOT EXISTS diferencia numeric(15,2),
  ADD COLUMN IF NOT EXISTS estado_arqueo text
    CHECK (estado_arqueo IS NULL OR estado_arqueo IN ('correcto', 'sobrante', 'faltante'));

ALTER TABLE public.control_caja_traspasos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS control_caja_traspasos_all ON public.control_caja_traspasos;
CREATE POLICY control_caja_traspasos_all ON public.control_caja_traspasos FOR ALL USING (true) WITH CHECK (true);

COMMIT;
