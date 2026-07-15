-- Organigrama / puestos

CREATE TABLE IF NOT EXISTS public.rrhh_puestos (
  id bigserial PRIMARY KEY,
  nombre text NOT NULL,
  sector text,
  id_puesto_padre bigint REFERENCES public.rrhh_puestos(id) ON DELETE SET NULL,
  activo boolean NOT NULL DEFAULT true,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_puestos_padre ON public.rrhh_puestos (id_puesto_padre);

ALTER TABLE public.legajos_empleados
  ADD COLUMN IF NOT EXISTS id_puesto bigint REFERENCES public.rrhh_puestos(id) ON DELETE SET NULL;

ALTER TABLE public.legajos_empleados
  ADD COLUMN IF NOT EXISTS id_jefe integer REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.rrhh_puestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rrhh_puestos_all ON public.rrhh_puestos;
CREATE POLICY rrhh_puestos_all ON public.rrhh_puestos FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.rrhh_puestos TO anon, authenticated, service_role;

-- Seed estructura básica (solo si vacío)
INSERT INTO public.rrhh_puestos (nombre, sector, id_puesto_padre, descripcion)
SELECT v.nombre, v.sector, NULL, v.descripcion
FROM (VALUES
  ('Gerencia', 'Gerencia', 'Dirección'),
  ('Administración', 'Administración', 'Admin / finanzas'),
  ('Recursos Humanos', 'Recursos Humanos', 'RRHH'),
  ('Diseño', 'Diseño', 'Diseño gráfico'),
  ('Imprenta', 'Imprenta', 'Producción impresión'),
  ('Taller gráfico', 'Taller gráfico', 'Acabados'),
  ('Instalaciones', 'Instalaciones', 'Campo'),
  ('Metalúrgica', 'Metalúrgica', 'Taller metal'),
  ('Mostrador', 'Mostrador', 'Atención'),
  ('Caja', 'Caja', 'Cobros'),
  ('Compras', 'Compras', 'Abastecimiento'),
  ('Asesor técnico', 'Asesor técnico', 'Asesoría'),
  ('Presupuestos', 'Presupuestos', 'Cotizaciones')
) AS v(nombre, sector, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.rrhh_puestos LIMIT 1);
