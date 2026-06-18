-- Ajustes globales sobre listas Flexxus: IVA + recargos % aplicados a todas las listas al vender.

BEGIN;

CREATE TABLE IF NOT EXISTS public.configuracion_precios_ventas (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  iva_porcentaje numeric(5, 2) NOT NULL DEFAULT 21,
  iva_activo boolean NOT NULL DEFAULT true,
  recargos jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.configuracion_precios_ventas IS
  'Ajustes % globales sobre precios netos Flexxus (todas las listas 1–5).';
COMMENT ON COLUMN public.configuracion_precios_ventas.recargos IS
  'Array JSON: [{ "id", "nombre", "porcentaje", "activo" }, ...]';

INSERT INTO public.configuracion_precios_ventas (id, iva_porcentaje, iva_activo, recargos)
VALUES (1, 21, true, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.configuracion_precios_ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracion_precios_ventas_anon_all ON public.configuracion_precios_ventas;
CREATE POLICY configuracion_precios_ventas_anon_all ON public.configuracion_precios_ventas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_configuracion_precios_ventas()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(c)
  FROM public.configuracion_precios_ventas c
  WHERE c.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.guardar_configuracion_precios_ventas(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recargos jsonb;
BEGIN
  v_recargos := COALESCE(p_payload->'recargos', '[]'::jsonb);
  IF jsonb_typeof(v_recargos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'recargos debe ser un array JSON';
  END IF;

  INSERT INTO public.configuracion_precios_ventas (
    id, iva_porcentaje, iva_activo, recargos, updated_at
  ) VALUES (
    1,
    COALESCE((p_payload->>'iva_porcentaje')::numeric, 21),
    COALESCE((p_payload->>'iva_activo')::boolean, true),
    v_recargos,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    iva_porcentaje = COALESCE((p_payload->>'iva_porcentaje')::numeric, configuracion_precios_ventas.iva_porcentaje),
    iva_activo = COALESCE((p_payload->>'iva_activo')::boolean, configuracion_precios_ventas.iva_activo),
    recargos = v_recargos,
    updated_at = now();

  RETURN public.get_configuracion_precios_ventas();
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.configuracion_precios_ventas TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracion_precios_ventas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_configuracion_precios_ventas(jsonb) TO anon, authenticated;

COMMIT;
