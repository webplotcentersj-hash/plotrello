-- Cierres, conciliaciones y diferencias (módulo Control de Cajas)

BEGIN;

CREATE TABLE IF NOT EXISTS public.control_caja_cierres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  caja_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  turno text NOT NULL DEFAULT 'Único',
  cajera text,
  email_ok text,
  fondo_fijo numeric(15,2) NOT NULL DEFAULT 0,
  ing_ef numeric(15,2) NOT NULL DEFAULT 0,
  egr_ef numeric(15,2) NOT NULL DEFAULT 0,
  ef_teorico numeric(15,2) NOT NULL DEFAULT 0,
  ef_contado numeric(15,2) NOT NULL DEFAULT 0,
  dif_ef numeric(15,2) NOT NULL DEFAULT 0,
  tarj_sist numeric(15,2) NOT NULL DEFAULT 0,
  tarj_fis numeric(15,2) NOT NULL DEFAULT 0,
  dif_tarj numeric(15,2) NOT NULL DEFAULT 0,
  mp_qr numeric(15,2) NOT NULL DEFAULT 0,
  trans numeric(15,2) NOT NULL DEFAULT 0,
  cta_cte numeric(15,2) NOT NULL DEFAULT 0,
  total_ventas numeric(15,2) NOT NULL DEFAULT 0,
  dif_total numeric(15,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'REVISAR' CHECK (estado IN ('OK', 'REVISAR')),
  observacion text,
  id_planilla uuid REFERENCES public.control_caja_planillas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_caja_cierres_fecha ON public.control_caja_cierres(fecha DESC);

CREATE TABLE IF NOT EXISTS public.control_caja_concil_mp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  sistema numeric(15,2) NOT NULL DEFAULT 0,
  dashboard numeric(15,2) NOT NULL DEFAULT 0,
  diferencia numeric(15,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'REVISAR' CHECK (estado IN ('OK', 'REVISAR')),
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.control_caja_concil_banco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  sistema numeric(15,2) NOT NULL DEFAULT 0,
  extracto numeric(15,2) NOT NULL DEFAULT 0,
  diferencia numeric(15,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'REVISAR' CHECK (estado IN ('OK', 'REVISAR')),
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.control_caja_diferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  caja_slug text REFERENCES public.control_caja_cajas(slug),
  tipo text NOT NULL CHECK (tipo IN ('Faltante', 'Sobrante')),
  monto numeric(15,2) NOT NULL,
  motivo text,
  responsable text,
  estado text NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Resuelto')),
  id_cierre uuid REFERENCES public.control_caja_cierres(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.control_caja_cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_caja_concil_mp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_caja_concil_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_caja_diferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS control_caja_cierres_all ON public.control_caja_cierres;
CREATE POLICY control_caja_cierres_all ON public.control_caja_cierres FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS control_caja_concil_mp_all ON public.control_caja_concil_mp;
CREATE POLICY control_caja_concil_mp_all ON public.control_caja_concil_mp FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS control_caja_concil_banco_all ON public.control_caja_concil_banco;
CREATE POLICY control_caja_concil_banco_all ON public.control_caja_concil_banco FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS control_caja_diferencias_all ON public.control_caja_diferencias;
CREATE POLICY control_caja_diferencias_all ON public.control_caja_diferencias FOR ALL USING (true) WITH CHECK (true);

COMMIT;
