-- Formulario externo de convocatoria (sin CV obligatorio)

BEGIN;

ALTER TABLE public.rrhh_postulaciones
  ALTER COLUMN cv_url DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.crear_postulacion_formulario_externo(
  p_nombre text,
  p_email text,
  p_telefono text,
  p_puesto text,
  p_categoria_puesto text,
  p_formulario jsonb,
  p_honeypot text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_nombre text;
  v_email text;
  v_puesto text;
  v_frase text;
  v_confirm_puesto text;
  v_recientes integer;
  v_metadata jsonb;
BEGIN
  IF coalesce(trim(p_honeypot), '') <> '' THEN
    RETURN 0;
  END IF;

  v_nombre := trim(p_nombre);
  v_email := lower(trim(p_email));
  v_puesto := trim(p_puesto);
  v_frase := trim(coalesce(p_formulario->>'frase_compromiso', ''));
  v_confirm_puesto := trim(coalesce(p_formulario->>'confirmacion_puesto', ''));

  IF length(v_nombre) < 2 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  IF length(v_puesto) < 2 THEN
    RAISE EXCEPTION 'Puesto requerido';
  END IF;
  IF v_frase <> 'Comprendo el compromiso' THEN
    RAISE EXCEPTION 'Debe escribir exactamente: Comprendo el compromiso';
  END IF;
  IF lower(v_confirm_puesto) <> lower(v_puesto) THEN
    RAISE EXCEPTION 'El nombre del puesto no coincide con la convocatoria';
  END IF;

  SELECT COUNT(*)::integer INTO v_recientes
    FROM public.rrhh_postulaciones p
   WHERE lower(p.email) = v_email
     AND p.created_at > now() - interval '1 hour';

  IF v_recientes >= 8 THEN
    RAISE EXCEPTION 'Demasiados envíos recientes desde este email. Intentá más tarde.';
  END IF;

  v_metadata := jsonb_build_object(
    'tipo', 'formulario_externo',
    'slug', coalesce(p_formulario->>'slug', ''),
    'respuestas', coalesce(p_formulario->'respuestas', '{}'::jsonb),
    'enviado_at', now()
  );

  INSERT INTO public.rrhh_postulaciones (
    nombre, email, telefono, puesto, categoria_puesto, mensaje,
    cv_url, cv_nombre, cv_mime, estado, metadata_ia
  ) VALUES (
    v_nombre,
    v_email,
    nullif(trim(p_telefono), ''),
    v_puesto,
    nullif(trim(p_categoria_puesto), ''),
    nullif(trim(coalesce(p_formulario->>'resumen', '')), ''),
    NULL,
    NULL,
    NULL,
    'nuevo',
    v_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_postulacion_formulario_externo(text, text, text, text, text, jsonb, text)
  TO anon, authenticated;

COMMENT ON FUNCTION public.crear_postulacion_formulario_externo IS
  'Alta de postulación desde formulario externo de convocatoria (sin CV).';

COMMIT;
