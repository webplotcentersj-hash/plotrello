CREATE OR REPLACE FUNCTION public.rrhh_importar_postulaciones_legacy(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  n integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) AS t(value)
  LOOP
    INSERT INTO public.rrhh_postulaciones (
      legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
      cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
    ) VALUES (
      (r->>'legacy_id')::integer,
      r->>'nombre',
      lower(r->>'email'),
      nullif(r->>'telefono', ''),
      coalesce(nullif(r->>'puesto', ''), 'Otro'),
      nullif(r->>'categoria_puesto', ''),
      nullif(r->>'mensaje', ''),
      r->>'cv_url',
      r->>'cv_nombre',
      r->>'cv_mime',
      coalesce(r->>'estado', 'nuevo'),
      nullif(r->>'notas_rrhh', ''),
      coalesce(r->'metadata_ia', '{}'::jsonb),
      coalesce((r->>'created_at')::timestamptz, now()),
      coalesce((r->>'updated_at')::timestamptz, now())
    )
    ON CONFLICT (legacy_id) DO NOTHING;
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rrhh_importar_postulaciones_legacy(jsonb) TO anon, authenticated, service_role;
