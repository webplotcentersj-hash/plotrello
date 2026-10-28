-- Turnos rotativos RRHH: plantillas por ciclo + slots + asignaciones a empleados.
-- Usado por RRHH → Turnos (calendario mensual).

BEGIN;

CREATE TABLE IF NOT EXISTS public.rrhh_turnos_rotacion (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  ciclo_dias integer NOT NULL CHECK (ciclo_dias BETWEEN 2 AND 56),
  fecha_ancla date NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rrhh_turnos_rotacion IS
  'Plantilla de turno rotativo: ciclo de N días anclado a una fecha.';

CREATE TABLE IF NOT EXISTS public.rrhh_turnos_rotacion_slots (
  id serial PRIMARY KEY,
  id_rotacion integer NOT NULL REFERENCES public.rrhh_turnos_rotacion(id) ON DELETE CASCADE,
  dia_offset integer NOT NULL CHECK (dia_offset >= 0),
  etiqueta text NOT NULL DEFAULT 'Turno',
  hora_entrada time without time zone,
  hora_salida time without time zone,
  es_franco boolean NOT NULL DEFAULT false,
  UNIQUE (id_rotacion, dia_offset)
);

COMMENT ON TABLE public.rrhh_turnos_rotacion_slots IS
  'Día del ciclo (0..ciclo-1): horario o franco.';

CREATE TABLE IF NOT EXISTS public.rrhh_turnos_rotacion_asignados (
  id serial PRIMARY KEY,
  id_rotacion integer NOT NULL REFERENCES public.rrhh_turnos_rotacion(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fase_offset integer NOT NULL DEFAULT 0,
  fecha_desde date NOT NULL,
  fecha_hasta date,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_rotacion_asignados_usuario
  ON public.rrhh_turnos_rotacion_asignados (id_usuario)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_rrhh_rotacion_asignados_rotacion
  ON public.rrhh_turnos_rotacion_asignados (id_rotacion)
  WHERE activo = true;

COMMENT ON TABLE public.rrhh_turnos_rotacion_asignados IS
  'Empleado en una rotación; fase_offset desplaza el día 0 del ciclo.';

ALTER TABLE public.rrhh_turnos_rotacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_turnos_rotacion_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_turnos_rotacion_asignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh_turnos_rotacion_all" ON public.rrhh_turnos_rotacion;
CREATE POLICY "rrhh_turnos_rotacion_all" ON public.rrhh_turnos_rotacion
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rrhh_turnos_rotacion_slots_all" ON public.rrhh_turnos_rotacion_slots;
CREATE POLICY "rrhh_turnos_rotacion_slots_all" ON public.rrhh_turnos_rotacion_slots
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rrhh_turnos_rotacion_asignados_all" ON public.rrhh_turnos_rotacion_asignados;
CREATE POLICY "rrhh_turnos_rotacion_asignados_all" ON public.rrhh_turnos_rotacion_asignados
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rrhh_turnos_rotacion TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rrhh_turnos_rotacion_slots TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rrhh_turnos_rotacion_asignados TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rrhh_turnos_rotacion_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rrhh_turnos_rotacion_slots_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rrhh_turnos_rotacion_asignados_id_seq TO anon, authenticated, service_role;

COMMIT;
