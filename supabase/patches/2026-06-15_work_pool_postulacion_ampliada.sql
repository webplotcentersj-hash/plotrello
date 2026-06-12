-- Formulario de postulación operarios externos: rubro, nivel, adjuntos y experiencia.

BEGIN;

ALTER TABLE public.work_pool_solicitudes
  ADD COLUMN IF NOT EXISTS rubro text,
  ADD COLUMN IF NOT EXISTS nivel text,
  ADD COLUMN IF NOT EXISTS titulo_texto text,
  ADD COLUMN IF NOT EXISTS experiencia text,
  ADD COLUMN IF NOT EXISTS referencias text,
  ADD COLUMN IF NOT EXISTS cv_url text,
  ADD COLUMN IF NOT EXISTS cv_nombre text,
  ADD COLUMN IF NOT EXISTS titulo_url text,
  ADD COLUMN IF NOT EXISTS titulo_nombre text,
  ADD COLUMN IF NOT EXISTS titulo_universitario_url text,
  ADD COLUMN IF NOT EXISTS titulo_universitario_nombre text,
  ADD COLUMN IF NOT EXISTS libreta_url text,
  ADD COLUMN IF NOT EXISTS libreta_nombre text,
  ADD COLUMN IF NOT EXISTS portfolio_archivo_url text,
  ADD COLUMN IF NOT EXISTS portfolio_archivo_nombre text;

ALTER TABLE public.work_pool_solicitudes DROP CONSTRAINT IF EXISTS work_pool_solicitudes_rubro_check;
ALTER TABLE public.work_pool_solicitudes
  ADD CONSTRAINT work_pool_solicitudes_rubro_check
  CHECK (rubro IS NULL OR rubro IN ('diseno', 'instalaciones', 'metalurgica'));

ALTER TABLE public.work_pool_solicitudes DROP CONSTRAINT IF EXISTS work_pool_solicitudes_nivel_check;
ALTER TABLE public.work_pool_solicitudes
  ADD CONSTRAINT work_pool_solicitudes_nivel_check
  CHECK (nivel IS NULL OR nivel IN ('estudiante', 'titulado', 'experto'));

CREATE INDEX IF NOT EXISTS idx_work_pool_solicitudes_rubro ON public.work_pool_solicitudes(rubro);
CREATE INDEX IF NOT EXISTS idx_work_pool_solicitudes_nivel ON public.work_pool_solicitudes(nivel);

DROP FUNCTION IF EXISTS public.work_pool_enviar_solicitud(text, text, text, text, text, text, text, text[], text);

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
  IF p_nivel NOT IN ('estudiante', 'titulado', 'experto') THEN
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

  IF p_nivel <> 'estudiante' AND NULLIF(trim(p_titulo_url), '') IS NULL THEN
    RAISE EXCEPTION 'el título o certificación es obligatorio para este nivel';
  END IF;

  IF p_rubro = 'diseno' THEN
    IF p_nivel = 'estudiante' AND NULLIF(trim(p_libreta_url), '') IS NULL THEN
      RAISE EXCEPTION 'los estudiantes de diseño deben adjuntar la libreta universitaria';
    END IF;
    IF p_nivel <> 'estudiante' AND NULLIF(trim(p_titulo_universitario_url), '') IS NULL THEN
      RAISE EXCEPTION 'el título universitario es obligatorio para diseñadores titulados o expertos';
    END IF;
    IF NULLIF(trim(p_portfolio_url), '') IS NULL AND NULLIF(trim(p_portfolio_archivo_url), '') IS NULL THEN
      RAISE EXCEPTION 'el portafolio (archivo o URL) es obligatorio para diseño';
    END IF;
  END IF;

  IF p_nivel = 'experto' AND NULLIF(trim(p_referencias), '') IS NULL THEN
    RAISE EXCEPTION 'las referencias son obligatorias para nivel experto';
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

GRANT EXECUTE ON FUNCTION public.work_pool_enviar_solicitud TO anon, authenticated;

-- Aprobar según rubro (diseño / instalaciones / metalúrgica)
CREATE OR REPLACE FUNCTION public.work_pool_aprobar_solicitud(
  p_id_solicitud integer,
  p_id_admin integer,
  p_usuario_login text,
  p_password text,
  p_notas_admin text DEFAULT NULL
)
RETURNS TABLE (id_usuario integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sol RECORD;
  v_rol text;
  v_sector text;
  v_rubro text;
  v_uid integer;
  v_nombre text;
BEGIN
  SELECT * INTO v_sol FROM public.work_pool_solicitudes WHERE id = p_id_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'solicitud no encontrada'; END IF;
  IF v_sol.estado <> 'pendiente' THEN RAISE EXCEPTION 'la solicitud ya fue procesada'; END IF;
  IF NULLIF(trim(p_usuario_login), '') IS NULL OR NULLIF(p_password, '') IS NULL THEN
    RAISE EXCEPTION 'usuario y contraseña obligatorios';
  END IF;

  v_rubro := COALESCE(
    v_sol.rubro,
    CASE v_sol.tipo WHEN 'diseno' THEN 'diseno' ELSE 'instalaciones' END
  );

  v_rol := CASE WHEN v_rubro = 'diseno' THEN 'operario-diseno' ELSE 'operario-bolsa' END;
  v_sector := CASE v_rubro
    WHEN 'diseno' THEN 'diseno'
    WHEN 'metalurgica' THEN 'metalurgica'
    ELSE 'instalaciones'
  END;
  v_nombre := trim(p_usuario_login);

  INSERT INTO public.usuarios (nombre, rol, password_hash, activo)
  VALUES (v_nombre, v_rol, crypt(p_password, gen_salt('bf')), true)
  RETURNING usuarios.id INTO v_uid;

  INSERT INTO public.work_pool_profiles (id_usuario, sector, skills, zona_cobertura, activo, aprobado, notas_admin)
  VALUES (
    v_uid,
    v_sector,
    COALESCE(v_sol.skills, '{}'),
    v_sol.zona_cobertura,
    true,
    true,
    COALESCE(NULLIF(trim(p_notas_admin), ''), v_sol.mensaje)
  )
  ON CONFLICT (id_usuario, sector) DO UPDATE SET
    skills = EXCLUDED.skills,
    zona_cobertura = EXCLUDED.zona_cobertura,
    aprobado = true,
    activo = true,
    notas_admin = EXCLUDED.notas_admin,
    updated_at = now();

  UPDATE public.work_pool_solicitudes
  SET estado = 'aprobada',
      id_usuario_creado = v_uid,
      revisado_por = p_id_admin,
      notas_admin = NULLIF(trim(p_notas_admin), ''),
      updated_at = now()
  WHERE id = p_id_solicitud;

  RETURN QUERY SELECT v_uid, v_nombre, v_rol;
END;
$$;

COMMIT;
