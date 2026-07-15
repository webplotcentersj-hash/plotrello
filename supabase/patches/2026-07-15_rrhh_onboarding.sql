-- Onboarding / checklist de ingreso

CREATE TABLE IF NOT EXISTS public.rrhh_onboarding_plantillas (
  id bigserial PRIMARY KEY,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rrhh_onboarding_items (
  id bigserial PRIMARY KEY,
  id_plantilla bigint NOT NULL REFERENCES public.rrhh_onboarding_plantillas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  obligatorio boolean NOT NULL DEFAULT true,
  responsable_rol text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rrhh_onboarding_items_plantilla
  ON public.rrhh_onboarding_items (id_plantilla, orden);

CREATE TABLE IF NOT EXISTS public.rrhh_onboarding_instancias (
  id bigserial PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  id_plantilla bigint NOT NULL REFERENCES public.rrhh_onboarding_plantillas(id) ON DELETE RESTRICT,
  estado text NOT NULL DEFAULT 'en_curso'
    CHECK (estado IN ('borrador', 'en_curso', 'completo')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rrhh_onboarding_instancias_usuario_uq UNIQUE (id_usuario)
);

CREATE TABLE IF NOT EXISTS public.rrhh_onboarding_progreso (
  id bigserial PRIMARY KEY,
  id_instancia bigint NOT NULL REFERENCES public.rrhh_onboarding_instancias(id) ON DELETE CASCADE,
  id_item bigint NOT NULL REFERENCES public.rrhh_onboarding_items(id) ON DELETE CASCADE,
  hecho boolean NOT NULL DEFAULT false,
  hecho_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  hecho_at timestamptz,
  nota text,
  CONSTRAINT rrhh_onboarding_progreso_uq UNIQUE (id_instancia, id_item)
);

CREATE INDEX IF NOT EXISTS idx_rrhh_onboarding_progreso_instancia
  ON public.rrhh_onboarding_progreso (id_instancia);

ALTER TABLE public.rrhh_onboarding_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_onboarding_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_onboarding_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rrhh_onboarding_progreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rrhh_onboarding_plantillas_all ON public.rrhh_onboarding_plantillas;
CREATE POLICY rrhh_onboarding_plantillas_all ON public.rrhh_onboarding_plantillas FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rrhh_onboarding_items_all ON public.rrhh_onboarding_items;
CREATE POLICY rrhh_onboarding_items_all ON public.rrhh_onboarding_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rrhh_onboarding_instancias_all ON public.rrhh_onboarding_instancias;
CREATE POLICY rrhh_onboarding_instancias_all ON public.rrhh_onboarding_instancias FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rrhh_onboarding_progreso_all ON public.rrhh_onboarding_progreso;
CREATE POLICY rrhh_onboarding_progreso_all ON public.rrhh_onboarding_progreso FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.rrhh_onboarding_plantillas TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_onboarding_items TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_onboarding_instancias TO anon, authenticated, service_role;
GRANT ALL ON public.rrhh_onboarding_progreso TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Seed plantilla default
INSERT INTO public.rrhh_onboarding_plantillas (id, nombre, activo)
VALUES (1, 'Ingreso estándar Plot', true)
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.rrhh_onboarding_plantillas', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.rrhh_onboarding_plantillas), 1)
);

INSERT INTO public.rrhh_onboarding_items (id_plantilla, titulo, orden, obligatorio, responsable_rol)
SELECT 1, v.titulo, v.orden, true, 'recursos-humanos'
FROM (VALUES
  ('Documentación DNI / CUIT', 1),
  ('Alta AFIP / aporte (nota RRHH)', 2),
  ('Foto de legajo', 3),
  ('Inducción de seguridad', 4),
  ('Acceso Plot Lab (usuario/clave)', 5),
  ('Uniforme / EPP', 6),
  ('Preocupacional / ART', 7)
) AS v(titulo, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rrhh_onboarding_items i WHERE i.id_plantilla = 1 AND i.titulo = v.titulo
);

-- Crear instancia + progreso para un usuario (plantilla activa)
CREATE OR REPLACE FUNCTION public.rrhh_onboarding_iniciar(
  p_id_usuario integer,
  p_id_plantilla bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plantilla bigint;
  v_instancia bigint;
  v_row public.rrhh_onboarding_instancias%ROWTYPE;
BEGIN
  IF p_id_plantilla IS NOT NULL THEN
    v_plantilla := p_id_plantilla;
  ELSE
    SELECT id INTO v_plantilla
    FROM public.rrhh_onboarding_plantillas
    WHERE activo
    ORDER BY id
    LIMIT 1;
  END IF;

  IF v_plantilla IS NULL THEN
    RAISE EXCEPTION 'No hay plantilla de onboarding activa';
  END IF;

  INSERT INTO public.rrhh_onboarding_instancias (id_usuario, id_plantilla, estado)
  VALUES (p_id_usuario, v_plantilla, 'en_curso')
  ON CONFLICT (id_usuario) DO UPDATE
    SET id_plantilla = EXCLUDED.id_plantilla
  RETURNING id INTO v_instancia;

  INSERT INTO public.rrhh_onboarding_progreso (id_instancia, id_item, hecho)
  SELECT v_instancia, i.id, false
  FROM public.rrhh_onboarding_items i
  WHERE i.id_plantilla = v_plantilla
  ON CONFLICT (id_instancia, id_item) DO NOTHING;

  SELECT * INTO v_row FROM public.rrhh_onboarding_instancias WHERE id = v_instancia;
  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_onboarding_iniciar(integer, bigint) TO anon, authenticated, service_role;
