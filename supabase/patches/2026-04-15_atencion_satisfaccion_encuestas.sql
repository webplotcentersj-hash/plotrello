-- Encuestas de satisfacción del cliente (página pública) + panel Atención al público.
-- Insert vía RPC SECURITY DEFINER (anon puede ejecutar). Lectura solo usuarios autenticados (RLS).

CREATE TABLE IF NOT EXISTS public.atencion_satisfaccion_encuestas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  departamento text NOT NULL,
  distrito text NOT NULL,
  edad smallint NOT NULL CHECK (edad >= 12 AND edad <= 110),
  sexo text NOT NULL CHECK (sexo IN ('f', 'm', 'x', 'prefiero_no_decir')),
  lat double precision NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng double precision NOT NULL CHECK (lng >= -180 AND lng <= 180),
  comentario varchar(600),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atencion_satisfaccion_created_at
  ON public.atencion_satisfaccion_encuestas (created_at DESC);

ALTER TABLE public.atencion_satisfaccion_encuestas ENABLE ROW LEVEL SECURITY;

-- La app usa la anon key con sesión propia (localStorage), no JWT de Supabase Auth:
-- el rol efectivo en el cliente es `anon`. Misma idea que otras tablas internas leídas desde el panel.
DROP POLICY IF EXISTS "atencion_satisfaccion_select_authenticated"
  ON public.atencion_satisfaccion_encuestas;

CREATE POLICY "atencion_satisfaccion_select_anon_authenticated"
  ON public.atencion_satisfaccion_encuestas
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.atencion_satisfaccion_encuestas IS 'Respuestas de encuesta pública de satisfacción; insert solo por RPC público.';

CREATE OR REPLACE FUNCTION public.registrar_encuesta_satisfaccion_public(
  p_rating smallint,
  p_departamento text,
  p_distrito text,
  p_edad smallint,
  p_sexo text,
  p_lat double precision,
  p_lng double precision,
  p_comentario text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_dep text;
  v_dis text;
  v_com text;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating inválido';
  END IF;
  IF p_edad IS NULL OR p_edad < 12 OR p_edad > 110 THEN
    RAISE EXCEPTION 'edad inválida';
  END IF;
  IF p_sexo IS NULL OR p_sexo NOT IN ('f', 'm', 'x', 'prefiero_no_decir') THEN
    RAISE EXCEPTION 'sexo inválido';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'ubicación inválida';
  END IF;

  v_dep := trim(both from coalesce(p_departamento, ''));
  v_dis := trim(both from coalesce(p_distrito, ''));
  IF length(v_dep) < 2 OR length(v_dep) > 120 THEN
    RAISE EXCEPTION 'departamento inválido';
  END IF;
  IF length(v_dis) < 2 OR length(v_dis) > 120 THEN
    RAISE EXCEPTION 'distrito inválido';
  END IF;

  v_com := nullif(trim(both from coalesce(p_comentario, '')), '');
  IF v_com IS NOT NULL AND length(v_com) > 600 THEN
    RAISE EXCEPTION 'comentario demasiado largo';
  END IF;

  INSERT INTO public.atencion_satisfaccion_encuestas (
    rating, departamento, distrito, edad, sexo, lat, lng, comentario
  ) VALUES (
    p_rating, v_dep, v_dis, p_edad, p_sexo, p_lat, p_lng, v_com
  )
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_encuesta_satisfaccion_public(smallint, text, text, smallint, text, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_encuesta_satisfaccion_public(smallint, text, text, smallint, text, double precision, double precision, text) TO anon, authenticated;

GRANT SELECT ON TABLE public.atencion_satisfaccion_encuestas TO anon, authenticated;
