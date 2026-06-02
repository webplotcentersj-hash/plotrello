-- Módulo Control de Cajas (/caja/dashboard)
-- Arqueos, movimientos entre cajas, maestro de cajas

BEGIN;

CREATE TABLE IF NOT EXISTS public.control_caja_cajas (
  slug text PRIMARY KEY,
  nombre text NOT NULL,
  fondo_fijo numeric(15,2) NOT NULL DEFAULT 0,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.control_caja_cajas (slug, nombre, fondo_fijo, activa) VALUES
  ('noelia', 'Caja Noelia', 100000, true),
  ('rosa', 'Caja Rosa', 100000, true),
  ('admin', 'Caja Administración', 0, true),
  ('vuelto', 'Caja Vuelto', 5000, true)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.control_caja_arqueos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  caja_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  turno text NOT NULL DEFAULT 'Único',
  id_usuario integer,
  usuario_nombre text,
  billetes jsonb NOT NULL DEFAULT '{}'::jsonb,
  total numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_caja_arqueos_fecha ON public.control_caja_arqueos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_control_caja_arqueos_caja ON public.control_caja_arqueos(caja_slug);

CREATE TABLE IF NOT EXISTS public.control_caja_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  hora time,
  concepto text NOT NULL,
  origen_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  destino_slug text NOT NULL REFERENCES public.control_caja_cajas(slug),
  efectivo numeric(15,2) NOT NULL DEFAULT 0,
  otros numeric(15,2) NOT NULL DEFAULT 0,
  nro_comprobante text,
  observacion text,
  id_usuario integer,
  usuario_nombre text,
  origen_importacion text NOT NULL DEFAULT 'manual' CHECK (origen_importacion IN ('manual', 'excel', 'planilla_pdf')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_caja_mov_fecha ON public.control_caja_movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_control_caja_mov_usuario ON public.control_caja_movimientos(usuario_nombre);

ALTER TABLE public.control_caja_cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_caja_arqueos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_caja_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS control_caja_cajas_all ON public.control_caja_cajas;
CREATE POLICY control_caja_cajas_all ON public.control_caja_cajas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS control_caja_arqueos_all ON public.control_caja_arqueos;
CREATE POLICY control_caja_arqueos_all ON public.control_caja_arqueos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS control_caja_movimientos_all ON public.control_caja_movimientos;
CREATE POLICY control_caja_movimientos_all ON public.control_caja_movimientos FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.control_caja_planillas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_nombre text NOT NULL,
  fecha_desde date,
  fecha_hasta date,
  caja_nombre text NOT NULL,
  caja_slug text REFERENCES public.control_caja_cajas(slug),
  totales jsonb,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  id_usuario integer,
  usuario_nombre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_caja_planillas_fecha ON public.control_caja_planillas(fecha_hasta DESC);

ALTER TABLE public.control_caja_planillas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS control_caja_planillas_all ON public.control_caja_planillas;
CREATE POLICY control_caja_planillas_all ON public.control_caja_planillas FOR ALL USING (true) WITH CHECK (true);

COMMIT;
