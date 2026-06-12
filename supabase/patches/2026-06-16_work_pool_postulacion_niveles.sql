-- Niveles ampliados: estudiante, junior, semi_senior, titulado, experto

BEGIN;

ALTER TABLE public.work_pool_solicitudes DROP CONSTRAINT IF EXISTS work_pool_solicitudes_nivel_check;
ALTER TABLE public.work_pool_solicitudes
  ADD CONSTRAINT work_pool_solicitudes_nivel_check
  CHECK (
    nivel IS NULL OR nivel IN ('estudiante', 'junior', 'semi_senior', 'titulado', 'experto')
  );

CREATE OR REPLACE FUNCTION public.work_pool_enviar_solicitud(
  p_rubro text,
  p_nivel text,
  p_nombre_completo text,
  p_email text,
  p_experiencia text,
  p_telefono text DEFAULT NULL,
  p_documento text DEFAULT NULL,
  p_titulo_texto text DEFAULT NULL,
  p_referencias text DEFAULT NULL,
  p_portfolio_url text DEFAULT NULL,
  p_mensaje text DEFAULT NULL,
  p_skills text[] DEFAULT '{}',
  p_zona_cobertura text DEFAULT NULL,
  p_cv_url text DEFAULT NULL,
  p_cv_nombre text DEFAULT NULL,
  p_titulo_url text DEFAULT NULL,
  p_titulo_nombre text DEFAULT NULL,
  p_titulo_universitario_url text DEFAULT NULL,
  p_titulo_universitario_nombre text DEFAULT NULL,
  p_libreta_url text DEFAULT NULL,
  p_libreta_nombre text DEFAULT NULL,
  p_portfolio_archivo_url text DEFAULT NULL,
  p_portfolio_archivo_nombre text DEFAULT NULL
)
RETURNS TABLE (id integer, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_tipo text;
BEGIN
  IF p_rubro NOT IN ('diseno', 'instalaciones', 'metalurgica') THEN
    RAISE EXCEPTION 'rubro inválido';
  END IF;
  IF p_nivel NOT IN ('estudiante', 'junior', 'semi_senior', 'titulado', 'experto') THEN
    RAISE EXCEPTION 'nivel inválido';
  END IF;
  IF NULLIF(trim(p_nombre_completo), '') IS NULL OR NULLIF(trim(p_email), '') IS NULL THEN
    RAISE EXCEPTION 'nombre y email son obligatorios';
  END IF;
  IF NULLIF(trim(p_experiencia), '') IS NULL THEN
    RAISE EXCEPTION 'la experiencia es obligatoria';
  END IF;
  IF NULLIF(trim(p_cv_url), '') IS NULL THEN
    RAISE EXCEPTION 'el CV es obligatorio';
  END IF;

  v_tipo := CASE WHEN p_rubro = 'diseno' THEN 'diseno' ELSE 'bolsa' END;

  IF p_nivel IN ('semi_senior', 'titulado', 'experto') AND NULLIF(trim(p_titulo_url), '') IS NULL THEN
    RAISE EXCEPTION 'el título o certificación es obligatorio para este nivel';
  END IF;

  IF p_rubro = 'diseno' THEN
    IF p_nivel = 'estudiante' AND NULLIF(trim(p_libreta_url), '') IS NULL THEN
      RAISE EXCEPTION 'los estudiantes de diseño deben adjuntar la libreta universitaria';
    END IF;
    IF p_nivel IN ('semi_senior', 'titulado', 'experto')
      AND NULLIF(trim(p_titulo_universitario_url), '') IS NULL THEN
      RAISE EXCEPTION 'el título universitario es obligatorio para diseñadores semi-senior, titulados o expertos';
    END IF;
    IF NULLIF(trim(p_portfolio_url), '') IS NULL AND NULLIF(trim(p_portfolio_archivo_url), '') IS NULL THEN
      RAISE EXCEPTION 'el portafolio (archivo o URL) es obligatorio para diseño';
    END IF;
  END IF;

  IF p_nivel IN ('experto', 'titulado') AND NULLIF(trim(p_referencias), '') IS NULL THEN
    RAISE EXCEPTION 'las referencias son obligatorias para nivel titulado o experto';
  END IF;

  IF p_nivel = 'semi_senior' AND p_rubro <> 'diseno' AND NULLIF(trim(p_referencias), '') IS NULL THEN
    RAISE EXCEPTION 'las referencias son obligatorias para semi-senior en instalaciones o metalúrgica';
  END IF;

  INSERT INTO public.work_pool_solicitudes (
    tipo, rubro, nivel, nombre_completo, email, telefono, documento,
    titulo_texto, experiencia, referencias, portfolio_url, mensaje, skills, zona_cobertura,
    cv_url, cv_nombre, titulo_url, titulo_nombre,
    titulo_universitario_url, titulo_universitario_nombre,
    libreta_url, libreta_nombre, portfolio_archivo_url, portfolio_archivo_nombre
  ) VALUES (
    v_tipo,
    p_rubro,
    p_nivel,
    trim(p_nombre_completo),
    lower(trim(p_email)),
    NULLIF(trim(p_telefono), ''),
    NULLIF(trim(p_documento), ''),
    NULLIF(trim(p_titulo_texto), ''),
    trim(p_experiencia),
    NULLIF(trim(p_referencias), ''),
    NULLIF(trim(p_portfolio_url), ''),
    NULLIF(trim(p_mensaje), ''),
    COALESCE(p_skills, '{}'),
    NULLIF(trim(p_zona_cobertura), ''),
    NULLIF(trim(p_cv_url), ''),
    NULLIF(trim(p_cv_nombre), ''),
    NULLIF(trim(p_titulo_url), ''),
    NULLIF(trim(p_titulo_nombre), ''),
    NULLIF(trim(p_titulo_universitario_url), ''),
    NULLIF(trim(p_titulo_universitario_nombre), ''),
    NULLIF(trim(p_libreta_url), ''),
    NULLIF(trim(p_libreta_nombre), ''),
    NULLIF(trim(p_portfolio_archivo_url), ''),
    NULLIF(trim(p_portfolio_archivo_nombre), '')
  )
  RETURNING work_pool_solicitudes.id INTO v_id;

  RETURN QUERY SELECT v_id, 'pendiente'::text;
END;
$$;

COMMIT;
